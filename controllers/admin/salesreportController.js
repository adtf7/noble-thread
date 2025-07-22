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
            query.createdOn = { $gte: startOfWeek, $lte: endOfWeek };
        } else if (filterType === 'monthly') {
            const today = new Date();
            const startOfMonth = new Date(today.getFullYear(), today.getMonth(), 1);
            const endOfMonth = new Date(today.getFullYear(), today.getMonth() + 1, 0);
            endOfMonth.setHours(23, 59, 59, 999); 
            query.createdOn = { $gte: startOfMonth, $lte: endOfMonth };
        } else if (filterType === 'yearly') {
            const today = new Date();
            const startOfYear = new Date(today.getFullYear(), 0, 1);
            const endOfYear = new Date(today.getFullYear(), 11, 31);
            endOfYear.setHours(23, 59, 59, 999); 
            query.createdOn = { $gte: startOfYear, $lte: endOfYear };
        } else if (filterType === 'custom' && startDate && endDate) {
            const end = new Date(endDate);

            end.setHours(23, 59, 59, 999); 
            query.createdOn = { $gte: new Date(startDate), $lte: end };

        }

        query.status = { $nin: ['Cancelled', 'Returned', 'Failed'] };

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
            dateRange.endDate.setHours(23, 59, 59, 999); 
            break;
        case 'yearly':
            dateRange.startDate = new Date(currentDate.getFullYear(), 0, 1);
            dateRange.endDate = new Date(currentDate.getFullYear(), 11, 31);
            dateRange.endDate.setHours(23, 59, 59, 999); 
            break;
        case 'custom':
            if (!startDate || !endDate) {
                throw new Error('startDate and endDate are required for custom filter.');
            }
            dateRange.startDate = new Date(startDate);
            dateRange.endDate = new Date(endDate);
            dateRange.endDate.setHours(23, 59, 59, 999);
            break;
        default:
            throw new Error('Invalid filter.');
    }

    const orders = await Order.find({
        createdOn: { $gte: dateRange.startDate, $lte: dateRange.endDate },
        status: { $nin: ['Cancelled', 'Returned', 'Failed'] }
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

        pdfDoc.fontSize(16).text('Order Details', { underline: true, align: 'center' });
        pdfDoc.moveDown();

        const table = {
            headers: [
                { label: "Order ID", property: 'orderId', width: 80, align: 'center' },
                { label: "User Email", property: 'userEmail', width: 120, align: 'center' },
                { label: "Discount", property: 'discount', width: 50, align: 'right' },
                { label: "Final Amount", property: 'finalAmount', width: 80, align: 'right' },
                { label: "Payment Method", property: 'paymentMethod', width: 90, align: 'center' },
                { label: "Status", property: 'status', width: 80, align: 'center' },
                { label: "Date", property: 'date', width: 100, align: 'center' },
            ],
            datas: reportData.orders.map(order => ({
                orderId: order._id.toString(),
                userName: order.userId ? order.userId.name : 'N/A',
                userEmail: order.userId ? order.userId.email : 'N/A',
                totalAmount: `₹${order.totalAmount.toFixed(2)}`,
                discount: `₹${Math.abs(order.discount || 0).toFixed(2)}`,
                finalAmount: `₹${order.finalAmount.toFixed(2)}`,
                paymentMethod: order.shoppingMethod,
                status: order.status,
                date: order.createdOn.toLocaleDateString(),
            })),
        };

        pdfDoc.table(table, {
            prepareHeader: () => pdfDoc.font('Helvetica-Bold').fontSize(10).fillColor('#222'),
            prepareRow: (row, i) => {
                pdfDoc.font('Helvetica').fontSize(9).fillColor('#222');
                if (i % 2 === 0) {
                    pdfDoc.rect(pdfDoc.x, pdfDoc.y, 700, 18).fill('#f5f5f5').fillColor('#222');
                }
            },
            columnSpacing: 5,
            padding: 4,
            hideHeader: false,
            minRowHeight: 18,
            width: 700,
            columns: [
                { property: 'orderId', align: 'center' },
                { property: 'userName', align: 'center' },
                { property: 'userEmail', align: 'center' },
                { property: 'totalAmount', align: 'right' },
                { property: 'discount', align: 'right' },
                { property: 'finalAmount', align: 'right' },
                { property: 'paymentMethod', align: 'center' },
                { property: 'status', align: 'center' },
                { property: 'date', align: 'center' },
            ]
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