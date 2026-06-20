import { Document, Packer, Paragraph, Table, TableRow, TableCell, TextRun, WidthType, AlignmentType, BorderStyle, HeadingLevel } from 'docx'
import { saveAs } from 'file-saver'
import jsPDF from 'jspdf'
import autoTable from 'jspdf-autotable'
import { format, parseISO } from 'date-fns'
import { ru } from 'date-fns/locale'

function formatDate(dateStr) {
  try { return format(parseISO(dateStr), 'd MMMM yyyy', { locale: ru }) }
  catch { return dateStr }
}

export async function exportToDocx(reportData, totals, dateStr) {
  const dateLabel = formatDate(dateStr)

  const headerRow = new TableRow({
    children: [
      cell('Команда', true),
      cell('♀ Всего', true),
      cell('♀ Отсутств.', true),
      cell('♂ Всего', true),
      cell('♂ Отсутств.', true),
      cell('Всего детей', true),
      cell('Присутствуют', true),
      cell('Отсутствуют', true),
    ],
    tableHeader: true,
  })

  const dataRows = reportData.map(t => new TableRow({
    children: [
      cell(`Команда №${t.number}`),
      cell(String(t.totalGirls)),
      cell(String(t.absentGirls)),
      cell(String(t.totalBoys)),
      cell(String(t.absentBoys)),
      cell(String(t.total)),
      cell(String(t.total - t.absent)),
      cell(String(t.absent)),
    ],
  }))

  const totalRow = new TableRow({
    children: [
      cell('ИТОГО', true),
      cell(String(totals.totalGirls), true),
      cell(String(totals.absentGirls), true),
      cell(String(totals.totalBoys), true),
      cell(String(totals.absentBoys), true),
      cell(String(totals.total), true),
      cell(String(totals.total - totals.absent), true),
      cell(String(totals.absent), true),
    ],
  })

  // Absent details
  const absentParagraphs = []
  reportData.forEach(t => {
    if (t.absentChildren.length > 0) {
      absentParagraphs.push(
        new Paragraph({
          text: `Команда №${t.number}:`,
          style: 'strong',
          children: [new TextRun({ text: `Команда №${t.number}:`, bold: true })],
        }),
        ...t.absentChildren.map(c =>
          new Paragraph({
            children: [new TextRun({ text: `  • ${c.name} — ${c.reason}` })],
          })
        )
      )
    }
  })

  const doc = new Document({
    sections: [{
      children: [
        new Paragraph({
          children: [new TextRun({ text: 'ДОЦ «Спутник»', bold: true, size: 28 })],
          alignment: AlignmentType.CENTER,
        }),
        new Paragraph({
          children: [new TextRun({ text: `Отчёт по посещаемости — ${dateLabel}`, size: 24 })],
          alignment: AlignmentType.CENTER,
          spacing: { after: 400 },
        }),
        new Table({
          width: { size: 100, type: WidthType.PERCENTAGE },
          rows: [headerRow, ...dataRows, totalRow],
        }),
        new Paragraph({ text: '', spacing: { after: 300 } }),
        ...(absentParagraphs.length > 0 ? [
          new Paragraph({
            children: [new TextRun({ text: 'Отсутствующие дети:', bold: true, size: 22 })],
            spacing: { before: 200, after: 100 },
          }),
          ...absentParagraphs,
        ] : []),
      ],
    }],
  })

  const blob = await Packer.toBlob(doc)
  saveAs(blob, `otchet_${dateStr}.docx`)
}

function cell(text, bold = false) {
  return new TableCell({
    children: [new Paragraph({
      children: [new TextRun({ text, bold })],
      alignment: AlignmentType.CENTER,
    })],
    margins: { top: 80, bottom: 80, left: 100, right: 100 },
  })
}

export function exportToPdf(reportData, totals, dateStr) {
  const dateLabel = formatDate(dateStr)
  const doc = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4' })

  // Fonts fallback: jsPDF doesn't include Cyrillic by default in landscape mode
  // We'll use a workaround with encoding
  doc.setFont('helvetica')

  doc.setFontSize(16)
  doc.text('DOTs Sputnik', doc.internal.pageSize.width / 2, 15, { align: 'center' })
  doc.setFontSize(12)
  doc.text(`Otchet po poseshchaemosti — ${dateStr}`, doc.internal.pageSize.width / 2, 23, { align: 'center' })

  const head = [['Komanda', 'Devochki (vsego)', 'Devochki (otsutstv.)', 'Malchiki (vsego)', 'Malchiki (otsutstv.)', 'Vsego', 'Prisutstvuyut', 'Otsutstvuyut']]
  const body = reportData.map(t => [
    `Komanda #${t.number}`,
    t.totalGirls,
    t.absentGirls,
    t.totalBoys,
    t.absentBoys,
    t.total,
    t.total - t.absent,
    t.absent,
  ])
  body.push(['ITOGO', totals.totalGirls, totals.absentGirls, totals.totalBoys, totals.absentBoys, totals.total, totals.total - totals.absent, totals.absent])

  autoTable(doc, {
    head,
    body,
    startY: 30,
    styles: { fontSize: 9, cellPadding: 3 },
    headStyles: { fillColor: [37, 99, 235], textColor: 255, fontStyle: 'bold' },
    footStyles: { fillColor: [229, 231, 235], fontStyle: 'bold' },
    alternateRowStyles: { fillColor: [248, 250, 252] },
    columnStyles: { 0: { fontStyle: 'bold' } },
  })

  // Absent children list
  let y = doc.lastAutoTable.finalY + 10
  const absent = reportData.filter(t => t.absentChildren.length > 0)
  if (absent.length > 0) {
    doc.setFontSize(11)
    doc.text('Otsutstvuyushchie deti:', 14, y)
    y += 7
    doc.setFontSize(9)
    absent.forEach(t => {
      doc.setFont('helvetica', 'bold')
      doc.text(`Komanda #${t.number}:`, 14, y)
      y += 5
      doc.setFont('helvetica', 'normal')
      t.absentChildren.forEach(c => {
        doc.text(`  • ${c.name} (${c.reason === 'Болезнь' ? 'Bolezn' : 'Semejnye obstoyatelstva'})`, 14, y)
        y += 5
      })
    })
  }

  doc.save(`otchet_${dateStr}.pdf`)
}
