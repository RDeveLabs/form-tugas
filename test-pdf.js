const { PDFDocument } = require('pdf-lib');
const fs = require('fs');

async function createSamplePdf() {
  const doc = await PDFDocument.create();
  const page = doc.addPage([600, 400]);
  page.drawText('Test PDF for compression', {
    x: 50,
    y: 350,
    size: 30
  });
  
  const pdfBytes = await doc.save();
  fs.writeFileSync('test.pdf', pdfBytes);
  console.log('Created test.pdf');
}

createSamplePdf();