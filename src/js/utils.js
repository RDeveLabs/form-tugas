import { PDFDocument, StandardFonts, rgb } from 'pdf-lib'

// Helper functions
export function getVisible(selector) {
  const els = Array.from(document.querySelectorAll(selector))
  return els.find(el => el.offsetParent !== null) || els[0] || null
}

// Create cover page
export async function createCoverPage(pertemuanNum, nama, nim) {
  const pdfDoc = await PDFDocument.create()
  const timesRomanFont = await pdfDoc.embedFont(StandardFonts.TimesRoman)
  const page = pdfDoc.addPage()
  const { width, height } = page.getSize()
  const labelX = 50
  const valueX = 145

  page.drawText(`Pertemuan ${pertemuanNum}`, {
    x: 50,
    y: height - 2 * 32,
    size: 32,
    font: timesRomanFont,
    color: rgb(0, 0, 0)
  })

  page.drawText('NAMA', {
    x: labelX,
    y: height - 7 * 13,
    size: 12,
    font: timesRomanFont
  })

  page.drawText(':', {
    x: labelX + 90,
    y: height - 7 * 13,
    size: 12,
    font: timesRomanFont
  })

  page.drawText(nama, {
    x: valueX,
    y: height - 7 * 13,
    size: 12,
    font: timesRomanFont
  })

  page.drawText('NIM', {
    x: labelX,
    y: height - 7 * 16,
    size: 12,
    font: timesRomanFont
  })

  page.drawText(':', {
    x: labelX + 90,
    y: height - 7 * 16,
    size: 12,
    font: timesRomanFont
  })

  page.drawText(nim, {
    x: valueX,
    y: height - 7 * 16,
    size: 12,
    font: timesRomanFont
  })

  page.drawText('KELAS', {
    x: labelX,
    y: height - 7 * 19,
    size: 12,
    font: timesRomanFont
  })

  page.drawText(':', {
    x: labelX + 90,
    y: height - 7 * 19,
    size: 12,
    font: timesRomanFont
  })

  page.drawText('TI.25.A.2', {
    x: valueX,
    y: height - 7 * 19,
    size: 12,
    font: timesRomanFont
  })

  return await pdfDoc.save()
}

// Merge PDFs
export async function mergePDFs(coverBytes, uploadedFileBytes) {
  const mergedPdf = await PDFDocument.create()
  
  // Add cover page
  const coverDoc = await PDFDocument.load(coverBytes)
  const [coverPage] = await mergedPdf.copyPages(coverDoc, [0])
  mergedPdf.addPage(coverPage)

  // Add uploaded file pages
  const uploadedDoc = await PDFDocument.load(uploadedFileBytes)
  const pages = await mergedPdf.copyPages(uploadedDoc, uploadedDoc.getPageIndices())
  pages.forEach((page) => mergedPdf.addPage(page))

  return await mergedPdf.save()
}

// Helper function untuk download
export function download(data, filename, type) {
  const blob = new Blob([data], { type })
  const url = URL.createObjectURL(blob)

  const a = document.createElement("a")
  a.href = url
  a.download = filename
  document.body.appendChild(a)
  a.click()

  document.body.removeChild(a)
  URL.revokeObjectURL(url)
}

// Helper function untuk upload ke Worker
export async function uploadToWorker(pdfBytes, filename) {
  try {
    const formData = new FormData()
    formData.append('file', new Blob([pdfBytes], { type: 'application/pdf' }))
    formData.append('filename', filename)

    const response = await fetch('https://pdf-merger-worker.rdevelopamd.workers.dev', {
      method: 'POST',
      body: formData
    })

    if (!response.ok) {
      const error = await response.json()
      throw new Error(error.error || 'Upload failed')
    }

    return await response.json()
  } catch (error) {
    console.error('Upload error:', error)
    throw error
  }
}

// UI Functions
export function showPage(page) {
  const nama = getVisible('#nama')?.value
  const nim = getVisible('#nim')?.value
  
  if (!nama && !nim) {
    alert("Isi dulu itu nama sama NIM-nya")
    return
  } else if (!nama) {
    alert("Lah iya, itu nama belum diisi tuh")
    return
  } else if (!nim) {
    alert("Lah iya, itu NIM belum diisi tuh")
    return
  }

  document.querySelectorAll(".halaman").forEach((div) => (div.style.display = "none"))
  const target = document.getElementById(page)
  if (target) target.style.display = "flex"
}

export function tampilkanSpan() {
  const pertemuanEl = getVisible('#pertemuanBerapa')
  const sampaiEl = getVisible('#sampai')
  const container = getVisible('#file-upload')
  const filePageEl = getVisible('#filePage')

  const pertemuan = parseInt(pertemuanEl?.value)
  const sampai = parseInt(sampaiEl?.value)

  if (!container) return

  container.innerHTML = "" // reset isi span
  if (filePageEl) filePageEl.style = "height: 500px;"
  container.style = ""

  if (!isNaN(pertemuan) && !isNaN(sampai)) {
    for (let i = pertemuan; i <= sampai; i++) {
      container.innerHTML += `
        <div class="bg-amber-100 rounded-md flex items-center justify-center cursor-pointer hover:bg-amber-200">
            <label for="files${i}" class="text-xl p-4 w-full cursor-pointer">Upload file pertemuan ${i}</label>
            <input required id="files${i}" type="file" accept=".pdf" hidden>
        </div>
      `
    }
    for (let i = pertemuan; i <= sampai; i++) {
      const input = document.getElementById(`files${i}`)
      const label = document.querySelector(`label[for=files${i}]`)
      if (!input || !label) continue
      input.onchange = function () {
        const fileName = this.files[0]?.name
        label.innerText = fileName ?? "Browse Files"
      }
    }
  } else {
    alert("Pilih pertemuan terlebih dahulu!")
    container.innerHTML = "Pilih pertemuan dulu"
  }
}

export function reset() {
  const namaEls = document.querySelectorAll('#nama')
  const nimEls = document.querySelectorAll('#nim')
  const pertemuanEls = document.querySelectorAll('#pertemuanBerapa')
  const sampaiEls = document.querySelectorAll('#sampai')

  namaEls.forEach(e => e.value = "")
  nimEls.forEach(e => e.value = "")
  pertemuanEls.forEach(e => e.value = "")
  sampaiEls.forEach(e => e.value = "")
}

// Initialize submit handlers
export function initSubmitHandlers() {
  const submitButtons = document.querySelectorAll("#submit")
  submitButtons.forEach(button => {
    button.addEventListener('click', async function() {
      try {
        button.disabled = true
        button.textContent = 'Memproses...'

        const nama = getVisible('#nama')?.value
        const nim = getVisible('#nim')?.value
        const pertemuan = parseInt(getVisible('#pertemuanBerapa')?.value)
        const sampai = parseInt(getVisible('#sampai')?.value)

        if (!nama || !nim || isNaN(pertemuan) || isNaN(sampai)) {
          alert('Mohon lengkapi semua data')
          return
        }

        const finalPdf = await PDFDocument.create()

        for(let i = pertemuan; i <= sampai; i++) {
          const coverBytes = await createCoverPage(i, nama, nim)
          const fileInput = document.getElementById(`files${i}`)
            
          if(fileInput?.files[0]) {
            const fileBytes = await fileInput.files[0].arrayBuffer()
            const mergedBytes = await mergePDFs(coverBytes, fileBytes)
            
            const mergedDoc = await PDFDocument.load(mergedBytes)
            const pages = await finalPdf.copyPages(mergedDoc, mergedDoc.getPageIndices())
            pages.forEach((page) => finalPdf.addPage(page))
          } else {
            alert(`Upload file untuk pertemuan ${i} dulu!`)
            return
          }
        }

        const pdfBytes = await finalPdf.save()
        
        // Upload ke worker untuk kompresi dan upload ke Drive
        try {
          const result = await uploadToWorker(pdfBytes, `${nama} (${nim}) TI.25.A.2.pdf`)
          if (result.success) {
            alert(`File berhasil diupload! Link: ${result.driveUrl}`)
            // Optional: juga download salinan lokal
            download(pdfBytes, `${nama} (${nim}) TI.25.A.2.pdf`, "application/pdf")
          } else {
            throw new Error(result.error || 'Upload gagal')
          }
        } catch (error) {
          console.error('Error:', error)
          alert('Gagal mengupload file: ' + error.message)
          // Tetap download versi lokal jika upload gagal
          download(pdfBytes, `${nama} (${nim}) TI.25.A.2.pdf`, "application/pdf")
        }
      } catch (error) {
        console.error('Error:', error)
        alert('Error: ' + error.message)
      } finally {
        button.disabled = false
        button.textContent = 'Kirim'
      }
    })
  })
}