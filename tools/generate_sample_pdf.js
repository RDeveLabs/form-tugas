const { PDFDocument, StandardFonts } = require('pdf-lib');
const fs = require('fs');

async function make() {
  const pdfDoc = await PDFDocument.create();
  const page = pdfDoc.addPage([400, 200]);
  const times = await pdfDoc.embedFont(StandardFonts.Helvetica);
  const { width, height } = page.getSize();
  const fontSize = 24;
  page.drawText('Sample PDF', { x: 50, y: height - 4 * fontSize, size: fontSize, font: times });
  const pdfBytes = await pdfDoc.save();
  fs.writeFileSync('sample.pdf', pdfBytes);
  console.log('sample.pdf generated');
}

make().catch(e => { console.error(e); process.exit(1); });
