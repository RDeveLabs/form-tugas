// PDF Merger Worker with ILovePDF compress
export default {
  async fetch(request, env) {
    // Handle CORS
    const corsHeaders = {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type',
      'Access-Control-Max-Age': '86400',
    };

    // Handle CORS preflight
    if (request.method === 'OPTIONS') {
      return new Response(null, {
        status: 204,
        headers: corsHeaders
      });
    }

    if (request.method !== 'POST') {
      return new Response('Method not allowed', { 
        status: 405,
        headers: corsHeaders
      });
    }

    try {
      // Get PDF bytes directly from request body
      const pdfBytes = await request.arrayBuffer();
      
      if (!pdfBytes || pdfBytes.byteLength === 0) {
        throw new Error('No PDF data received');
      }

      // Create a blob for ILovePDF API
      const pdfBlob = new Blob([pdfBytes], { type: 'application/pdf' });

      // Perform ILovePDF compress flow
      const compressedBlob = await compressPdf(pdfBlob, env.ILOVEPDF_PUBLIC_KEY);

      // Return PDF bytes directly so the caller can download/inspect the compressed file
      return new Response(await compressedBlob.arrayBuffer(), {
        status: 200,
        headers: {
                    'Content-Type': 'application/pdf',
          'Content-Length': String(compressedBlob.size),
          ...corsHeaders
        }
      });
    } catch (error) {
      console.error('Error:', error);
      return new Response(
        JSON.stringify({ success: false, error: error.message }), 
        { 
          status: 500,
          headers: {
            'Content-Type': 'application/json',
            'Access-Control-Allow-Origin': '*'
          }
        }
      );
    }
  }
};

async function compressPdf(file, apiKey) {
  // apiKey here is expected to be the PUBLIC key (we'll call /auth to get a token)
  const start = await startTask(apiKey);
  const uploadResp = await uploadFile(start, file);
  // uploadResp may contain server_filename
  const serverFilename = uploadResp.server_filename || (uploadResp.files && uploadResp.files[0] && uploadResp.files[0].server_filename);
  await processTask(start, serverFilename, uploadResp.filename || file.name || 'file.pdf');
  return await downloadResult(start);
}

async function startTask(apiKey) {
  // 1) Request a short-lived token from /auth using the public key
  const authResp = await fetch('https://api.ilovepdf.com/v1/auth', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({ public_key: apiKey })
  });
  if (!authResp.ok) {
    const txt = await authResp.text();
    throw new Error('Failed to get ILovePDF auth token: ' + txt);
  }
  const { token } = await authResp.json();

  // 2) Call start for the compress tool to obtain server and task id
  const startResp = await fetch('https://api.ilovepdf.com/v1/start/compress', {
    method: 'GET',
    headers: { 'Authorization': `Bearer ${token}` }
  });
  if (!startResp.ok) {
    const txt = await startResp.text();
    throw new Error('Failed to start compress task: ' + txt);
  }
  const startJson = await startResp.json();
  // startJson contains server and task
  return { token, server: startJson.server, task: startJson.task };
}

async function uploadFile(task, file) {
  const formData = new FormData();
  formData.append('file', file);
  formData.append('task', task.task);

  const uploadUrl = `https://${task.server}/v1/upload`;
  const response = await fetch(uploadUrl, {
    method: 'POST',
    body: formData,
    headers: {
      'Authorization': `Bearer ${task.token}`
    }
  });

  if (!response.ok) {
    const txt = await response.text();
    throw new Error('Failed to upload file: ' + txt);
  }
  return await response.json();
}

async function processTask(task, serverFilename, originalFilename) {
  const processUrl = `https://${task.server}/v1/process`;
  const body = {
    task: task.task,
    tool: 'compress',
    files: [{ server_filename: serverFilename, filename: originalFilename }],
    // default compression level
    compression_level: 'recommended'
  };

  const response = await fetch(processUrl, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${task.token}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify(body)
  });

  if (!response.ok) {
    const txt = await response.text();
    throw new Error('Failed to process file: ' + txt);
  }
  return await response.json();
}

async function downloadResult(task) {
  const dlUrl = `https://${task.server}/v1/download/${task.task}`;
  const response = await fetch(dlUrl, {
    headers: { 'Authorization': `Bearer ${task.token}` }
  });
  if (!response.ok) {
    const txt = await response.text();
    throw new Error('Failed to download compressed file: ' + txt);
  }
  return await response.blob();
}

async function uploadToDrive(file, filename, serviceAccountKey, folderId) {
  // serviceAccountKey may be a JSON string stored as secret
  const sa = typeof serviceAccountKey === 'string' ? JSON.parse(serviceAccountKey) : serviceAccountKey;
  const auth = await getGoogleAuth(sa);

  const metadata = {
    name: filename,
    mimeType: 'application/pdf',
    parents: folderId ? [folderId] : undefined
  };

  const form = new FormData();
  form.append('metadata', new Blob([JSON.stringify(metadata)], { type: 'application/json' }));
  form.append('file', file);

  const response = await fetch('https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${auth.access_token}`
    },
    body: form
  });

  if (!response.ok) {
    const txt = await response.text();
    throw new Error('Failed to upload to Drive: ' + txt);
  }
  const result = await response.json();

  // Make file publicly viewable by creating permission
  const permResp = await fetch(`https://www.googleapis.com/drive/v3/files/${result.id}/permissions`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${auth.access_token}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({ role: 'reader', type: 'anyone' })
  });

  if (!permResp.ok) {
    const txt = await permResp.text();
    console.warn('Failed to set permission:', txt);
    // Not fatal — continue
  }

  return `https://drive.google.com/file/d/${result.id}/view`;
}

async function getGoogleAuth(sa) {
  const now = Math.floor(Date.now() / 1000);
  const claim = {
    iss: sa.client_email,
    scope: 'https://www.googleapis.com/auth/drive',
    aud: 'https://oauth2.googleapis.com/token',
    exp: now + 3600,
    iat: now
  };

  const assertion = await signJWT(claim, sa.private_key);

  const response = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded'
    },
    body: new URLSearchParams({
      grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer',
      assertion: assertion
    })
  });

  if (!response.ok) {
    const txt = await response.text();
    throw new Error('Failed to get Google auth token: ' + txt);
  }
  return await response.json();
}

// --- JWT RS256 signing using Web Crypto ---
function base64UrlEncode(input) {
  if (input instanceof Uint8Array) {
    let str = '';
    for (let i = 0; i < input.length; i++) {
      str += String.fromCharCode(input[i]);
    }
    return btoa(str).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/g, '');
  }
  return btoa(input).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/g, '');
}

function pemToArrayBuffer(pem) {
  // strip header/footer
  const b64 = pem.replace(/-----BEGIN PRIVATE KEY-----/, '').replace(/-----END PRIVATE KEY-----/, '').replace(/\s+/g, '');
  const binary = atob(b64);
  const len = binary.length;
  const bytes = new Uint8Array(len);
  for (let i = 0; i < len; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes.buffer;
}

async function signJWT(claim, privateKeyPem) {
  const header = { alg: 'RS256', typ: 'JWT' };
  const enc = new TextEncoder();
  const headerB64 = base64UrlEncode(JSON.stringify(header));
  const payloadB64 = base64UrlEncode(JSON.stringify(claim));
  const signingInput = `${headerB64}.${payloadB64}`;

  // Import private key
  const pkBuffer = pemToArrayBuffer(privateKeyPem);
  const key = await crypto.subtle.importKey(
    'pkcs8',
    pkBuffer,
    {
      name: 'RSASSA-PKCS1-v1_5',
      hash: { name: 'SHA-256' }
    },
    false,
    ['sign']
  );

  const signature = await crypto.subtle.sign(
    { name: 'RSASSA-PKCS1-v1_5' },
    key,
    enc.encode(signingInput)
  );

  const sigB64 = base64UrlEncode(new Uint8Array(signature));
  return `${signingInput}.${sigB64}`;
}