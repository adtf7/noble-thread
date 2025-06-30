const Order = require('../../models/orderSchema');
const PDFDocument = require('pdfkit');
require('pdfkit-table');
const ExcelJS = require("exceljs");


let loadsalesreport = async (req, res) => {
    try {
        const { filterType, startDate, endDate } = req.query;
        console.log('filterType:', filterType);

        let query = {};
        if (filterType === 'daily') {
            const today = new Date();
            query.createdOn = { $gte: new Date(today.setHours(0, 0, 0, 0)), $lt: new Date(today.setHours(23, 59, 59, 999)) };
        } else if (filterType === 'weekly') {
            const today = new Date();
            const startOfWeek = new Date(today.setDate(today.getDate() - today.getDay()));
            const endOfWeek = new Date(startOfWeek);
            endOfWeek.setDate(startOfWeek.getDate() + 6);
            endOfWeek.setHours(23, 59, 59, 999);
            query.createdOn = { $gte: startOfWeek, $lt: endOfWeek };
        } else if (filterType === 'monthly') {
            const today = new Date();
            const startOfMonth = new Date(today.getFullYear(), today.getMonth(), 1);
            const endOfMonth = new Date(today.getFullYear(), today.getMonth() + 1, 0);
            query.createdOn = { $gte: startOfMonth, $lt: endOfMonth };
        } else if (filterType === 'yearly') {
            const today = new Date();
            const startOfYear = new Date(today.getFullYear(), 0, 1);
            const endOfYear = new Date(today.getFullYear(), 11, 31);
            query.createdOn = { $gte: startOfYear, $lt: endOfYear };
        } else if (filterType === 'custom' && startDate && endDate) {
            query.createdOn = { $gte: new Date(startDate), $lt: new Date(endDate) };
        }

        query.status = { $nin: ['Cancelled', 'Returned'] };

        console.log("Final Query:", query);

        const orders = await Order.find(query)
            .populate('userId', 'name email')
            .sort({ createdOn: -1 });

        const totalSales = orders.reduce((sum, order) => sum + order.finalAmount, 0);
        const overallSalesCount = orders.length;
        const overallDiscount = orders.reduce((sum, order) => sum + Math.abs(order.discount || 0), 0);

        res.render("admin/salesreport", {
            currentPage: 'salesreport',
            orders,
            totalSales,
            overallSalesCount,
            overallDiscount,
            filterType: filterType || 'all',
            startDate: startDate || '',
            endDate: endDate || ''
        });
    } catch (error) {
        console.error("Error loading sales report:", error);
        res.status(500).send("Internal Server Error");
    }
};

const fetchSalesReportData = async (filterType, startDate, endDate) => {
    let dateRange = {};
    const currentDate = new Date();

    switch (filterType) {
        case 'daily':
            dateRange.startDate = new Date(currentDate.setHours(0, 0, 0, 0));
            dateRange.endDate = new Date(currentDate.setHours(23, 59, 59, 999));
            break;
        case 'weekly':
            const startOfWeek = new Date(currentDate.setDate(currentDate.getDate() - currentDate.getDay()));
            const endOfWeek = new Date(startOfWeek);
            endOfWeek.setDate(startOfWeek.getDate() + 6);
            endOfWeek.setHours(23, 59, 59, 999);
            dateRange.startDate = startOfWeek;
            dateRange.endDate = endOfWeek;
            break;
        case 'monthly':
            dateRange.startDate = new Date(currentDate.getFullYear(), currentDate.getMonth(), 1);
            dateRange.endDate = new Date(currentDate.getFullYear(), currentDate.getMonth() + 1, 0);
            break;
        case 'yearly':
            dateRange.startDate = new Date(currentDate.getFullYear(), 0, 1);
            dateRange.endDate = new Date(currentDate.getFullYear(), 11, 31);
            break;
        case 'custom':
            if (!startDate || !endDate) {
                throw new Error('startDate and endDate are required for custom filter.');
            }
            dateRange.startDate = new Date(startDate);
            dateRange.endDate = new Date(endDate);
            break;
        default:
            throw new Error('Invalid filter.');
    }

    const orders = await Order.find({
        createdOn: { $gte: dateRange.startDate, $lte: dateRange.endDate },
        status: { $nin: ['Cancelled', 'Returned'] }
    }).populate('userId', 'name email'); 

    const salesCount = orders.length;
    const totalOrderAmount = orders.reduce((sum, order) => sum + order.totalAmount, 0);
    const totalDiscount = orders.reduce((sum, order) => sum + Math.abs(order.discount || 0), 0);

    return {
        filter: filterType,
        startDate: dateRange.startDate,
        endDate: dateRange.endDate,
        salesCount,
        totalOrderAmount,
        totalDiscount,
        orders,
    };
};
let salespdf = async (req, res) => {
    try {
        const { filterType, startDate, endDate } = req.query;

        const reportData = await fetchSalesReportData(filterType, startDate, endDate);

        const PDFDocument = require('pdfkit-table');
        const pdfDoc = new PDFDocument({ margin: 30 });
        res.setHeader('Content-Type', 'application/pdf');
        res.setHeader('Content-Disposition', `attachment; filename=sales-report-${Date.now()}.pdf`);

        pdfDoc.pipe(res);

        pdfDoc.fontSize(18).text('Sales Report', { align: 'center' });
        pdfDoc.moveDown();
        pdfDoc.fontSize(12).text(`Filter: ${reportData.filter}`);
        pdfDoc.text(`Date Range: ${reportData.startDate.toDateString()} - ${reportData.endDate.toDateString()}`);
        pdfDoc.moveDown();
        pdfDoc.text(`Total Sales: ${reportData.salesCount}`);
        pdfDoc.text(`Total Order Amount: ₹${reportData.totalOrderAmount.toFixed(2)}`);
        pdfDoc.text(`Total Discount: ₹${reportData.totalDiscount.toFixed(2)}`);
        pdfDoc.moveDown();

        pdfDoc.fontSize(14).text('Order Details:', { underline: true });
        pdfDoc.moveDown();

        const table = {
            headers: [
                { label: "Order ID", property: 'orderId', width: 80, renderer: null },
                { label: "User Name", property: 'userName', width: 100, renderer: null }, 
                { label: "User Email", property: 'userEmail', width: 120, renderer: null },
                { label: "Total Amount", property: 'totalAmount', width: 80, renderer: null },
                { label: "Discount", property: 'discount', width: 80, renderer: null },
                { label: "Date", property: 'date', width: 100, renderer: null },
            ],
            datas: reportData.orders.map((order, index) => ({
                orderId: order.orderId,
                userName: order.userId ? order.userId.name : 'N/A', 
                userEmail: order.userId ? order.userId.email : 'N/A',
                totalAmount: `₹${order.totalAmount.toFixed(2)}`,
                discount: `₹${Math.abs(order.discount || 0)}`,
                date: order.createdOn.toDateString(),
            })),
        };

        pdfDoc.table(table, {
            prepareHeader: () => pdfDoc.font('Helvetica-Bold').fontSize(10),
            prepareRow: (row, indexColumn, indexRow, rectRow) => {
                pdfDoc.font('Helvetica').fontSize(10);
                if (indexRow % 2 === 0) {
                    pdfDoc.rect(rectRow.x, rectRow.y, rectRow.width, rectRow.height).fill('#f0f0f0');
                    pdfDoc.fillColor('black');
                }
            },
            padding: 5,
        });

        pdfDoc.end();
    } catch (error) {
        console.error('Error generating PDF:', error);
        res.status(500).json({ success: false, message: 'Internal server error.' });
    }
};

let downloadSalesReportExcel = async (req, res) => {
    try {
        const { filterType, startDate, endDate } = req.query;

        const reportData = await fetchSalesReportData(filterType, startDate, endDate);

        const workbook = new ExcelJS.Workbook();
        const worksheet = workbook.addWorksheet('Sales Report');

        worksheet.columns = [
            { header: 'Order ID', key: 'orderId', width: 20 },
            { header: 'User Name', key: 'userName', width: 20 }, 
            { header: 'User Email', key: 'userEmail', width: 30 },
            { header: 'Order Date', key: 'orderDate', width: 20 },
            { header: 'Total Amount', key: 'totalAmount', width: 15 },
            { header: 'Discount', key: 'discount', width: 15 },
            { header: 'Final Amount', key: 'finalAmount', width: 15 },
            { header: 'Payment Method', key: 'paymentMethod', width: 20 },
            { header: 'Status', key: 'status', width: 15 },
        ];

        reportData.orders.forEach((order) => {
            worksheet.addRow({
                orderId: order.orderId,
                userName: order.userId ? order.userId.name : 'N/A',
                userEmail: order.userId ? order.userId.email : 'N/A',
                orderDate: order.createdOn.toDateString(),
                totalAmount: order.totalAmount,
                discount: Math.abs(order.discount || 0),
                finalAmount: order.finalAmount,
                paymentMethod: order.shoppingMethod,
                status: order.status,
            });
        });

        worksheet.addRow([]);
        worksheet.addRow(['Total Sales', reportData.salesCount]);
        worksheet.addRow(['Total Order Amount', `₹${reportData.totalOrderAmount.toFixed(2)}`]);
        worksheet.addRow(['Total Discount', `₹${reportData.totalDiscount.toFixed(2)}`]);

        res.setHeader(
            'Content-Type',
            'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
        );
        res.setHeader(
            'Content-Disposition',
            `attachment; filename=sales-report-${Date.now()}.xlsx`
        );

        await workbook.xlsx.write(res);
        res.end();
    } catch (error) {
        console.error('Error generating Excel:', error);
        res.status(500).json({ success: false, message: 'Internal server error.' });
    }
};


module.exports = {
    loadsalesreport,
    salespdf,
    downloadSalesReportExcel
};