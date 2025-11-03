import { PDFDocument, StandardFonts, rgb } from 'pdf-lib';
import { getVisible } from './script.js';

// Create cover page for a pertemuan
async function createCoverPage(pertemuanNum, nama, nim) {
  const pdfDoc = await PDFDocument.create()
  const timesRomanFont = await pdfDoc.embedFont(StandardFonts.TimesRoman)
  const page = pdfDoc.addPage()
  const { width, height } = page.getSize()
  const labelX = 50;
  const valueX = 145;

  page.drawText(`Pertemuan ${pertemuanNum}`, {
    x: 50,
    y: height - 2 * 32,
    size: 32,
    font: timesRomanFont,
    color: rgb(0, 0, 0)
  })

  page.drawText('Nama', {
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

  page.drawText('Kelas', {
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

  page.drawText('Mata Kuliah', {
      x: labelX,
      y: height - 7 * 22,
      size: 12,
      font: timesRomanFont
  })

  page.drawText(':', {
      x: labelX + 90,
      y: height - 7 * 22,
      size: 12,
      font: timesRomanFont
  })

  page.drawText('Matematika', {
      x: valueX,
      y: height - 7 * 22,
      size: 12,
      font: timesRomanFont
  })

  page.drawText('Dosen Pengampu', {
      x: labelX,
      y: height - 7 * 25,
      size: 12,
      font: timesRomanFont
  })

  page.drawText(':', {
      x: labelX + 90,
      y: height - 7 * 25,
      size: 12,
      font: timesRomanFont
  })

  page.drawText('Ir. U. Darmanto Soer, M.Kom.', {
      x: valueX,
      y: height - 7 * 25,
      size: 12,
      font: timesRomanFont
  })

  return await pdfDoc.save()
}

// Merge PDFs for a pertemuan
async function mergePDFs(coverBytes, uploadedFileBytes) {
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

function download(data, filename, type) {
  const blob = new Blob([data], { type });
  const url = URL.createObjectURL(blob);

  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();

  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

// Helper function untuk mengecek ukuran file
function getFileSizeInMB(bytes) {
  return (bytes / (1024 * 1024)).toFixed(2);
}

// Gunakan getVisible untuk mendapatkan tombol submit yang aktif
const submitButtons = document.querySelectorAll("#submit");
submitButtons.forEach(button => {
  button.addEventListener('click', async function() {
    try {
      button.disabled = true;
      button.textContent = 'Memproses...';

      const nama = getVisible('#nama')?.value;
      const nim = getVisible('#nim')?.value;
      const pertemuan = parseInt(getVisible('#pertemuanBerapa')?.value);
      const sampai = parseInt(getVisible('#sampai')?.value);

    if (!nama || !nim || isNaN(pertemuan) || isNaN(sampai)) {
      alert('Mohon lengkapi semua data');
      return;
    }

    const finalPdf = await PDFDocument.create();

    for(let i = pertemuan; i <= sampai; i++) {
      const coverBytes = await createCoverPage(i, nama, nim);
      const fileInput = document.getElementById(`files${i}`);
        
      if(fileInput?.files[0]) {
        const fileBytes = await fileInput.files[0].arrayBuffer();
        const mergedBytes = await mergePDFs(coverBytes, fileBytes);
        
        const mergedDoc = await PDFDocument.load(mergedBytes);
        const pages = await finalPdf.copyPages(mergedDoc, mergedDoc.getPageIndices());
        pages.forEach((page) => finalPdf.addPage(page));
      } else {
        alert(`Upload file untuk pertemuan ${i} dulu!`);
        return;
      }
    }

    const pdfBytes = await finalPdf.save();
    download(pdfBytes, `${nama} (${nim}) TI.25.A.2.pdf`, "application/pdf");
    alert('File berhasil di-merge dan didownload!');

    } catch (error) {
      console.error('Error:', error);
      alert('Error: ' + error.message);
    } finally {
      button.disabled = false;
      button.textContent = 'Kirim';
    }
  });
});
