import * as XLSX from 'xlsx'
import { jsPDF } from 'jspdf'
import autoTable from 'jspdf-autotable'

export interface ExportPdfOptions {
    title: string
    companyName: string
    dateRange: string
    headers: string[]
    rows: any[][]
    filename: string
}

export const reportExport = {
    /**
     * Export data to Excel (.xlsx)
     * @param data Array of objects (rows) with keys matching column names
     * @param filename Filename without extension
     */
    toExcel: (data: any[], filename: string) => {
        const worksheet = XLSX.utils.json_to_sheet(data)
        const workbook = XLSX.utils.book_new()
        XLSX.utils.book_append_sheet(workbook, worksheet, 'Report')
        XLSX.writeFile(workbook, `${filename}.xlsx`)
    },

    /**
     * Export data to PDF with professional styling
     */
    toPDF: (options: ExportPdfOptions) => {
        const { title, companyName, dateRange, headers, rows, filename } = options
        const doc = new jsPDF('p', 'mm', 'a4')

        // Header Section
        doc.setFontSize(18)
        doc.setTextColor(40)
        doc.text(companyName || 'FINOVA REPORT', 14, 22)

        doc.setFontSize(14)
        doc.setTextColor(100)
        doc.text(title, 14, 30)

        doc.setFontSize(10)
        doc.setTextColor(150)
        doc.text(dateRange, 14, 36)

        // Divider
        doc.setDrawColor(200, 200, 200)
        doc.line(14, 40, 196, 40)

        // Table
        autoTable(doc, {
            head: [headers],
            body: rows,
            startY: 45,
            theme: 'striped',
            headStyles: {
                fillColor: [63, 81, 181], // Indigo
                textColor: [255, 255, 255],
                fontSize: 10,
                fontStyle: 'bold',
                halign: 'center'
            },
            bodyStyles: {
                fontSize: 9,
                textColor: [50, 50, 50]
            },
            alternateRowStyles: {
                fillColor: [245, 247, 250]
            },
            margin: { top: 45 },
            didDrawPage: (data) => {
                // Footer
                const str = 'Page ' + doc.getNumberOfPages()
                doc.setFontSize(10)
                const pageSize = doc.internal.pageSize
                const pageHeight = pageSize.height ? pageSize.height : pageSize.getHeight()
                doc.text(str, data.settings.margin.left, pageHeight - 10)
            }
        })

        doc.save(`${filename}.pdf`)
    }
}
