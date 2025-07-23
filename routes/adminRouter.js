let express = require("express");
let router = express.Router();
let userControllers = require("../controllers/admin/usercontroller");
let adminControllers = require("../controllers/admin/adminControllers");
let { userauth, adminauth } = require("../middlewares/auth");
let categoryControllers = require("../controllers/admin/categoryControllers");
const category = require("../models/categorySchema");
let productControllers = require("../controllers/admin/productController");
const multer = require("multer");
let storage = require("../helpers/multer");
const upload = multer({ storage: storage });
const orderControllers = require("../controllers/admin/ordercontroller");
let couponControllers = require("../controllers/admin/couponController");
let salesreportControllers = require("../controllers/admin/salesreportController");
let dashboardControllers = require("../controllers/admin/dashboardController");
let walletControllers = require("../controllers/admin/walletController");

router.get("/admin-login", adminControllers.loadlogin);
router.post("/loginverify", adminControllers.loginAdmin);
router.get("/pageerror", adminControllers.pageerror);
router.get("/logout", adminControllers.logout);
router.get("/dashboard", adminauth, dashboardControllers.loadDashboard);

router.get("/customers", adminauth, userControllers.customer);
router.get("/block-user", adminauth, userControllers.blockuser);
router.get("/unblock-user", adminauth, userControllers.unblockuser);

router.get("/category", adminauth, categoryControllers.categoryinfo);
router.post("/add-category", adminauth, categoryControllers.addcategory);
router.get("/listcategory", adminauth, categoryControllers.listcategory);
router.get("/unlistcategory", adminauth, categoryControllers.unlistcategory);
router.get("/categoryedit", adminauth, categoryControllers.editcategory);
router.post(
  "/categoryedit/:id",
  adminauth,
  categoryControllers.seteditcategory
);
router.delete("/category/:id", adminauth, categoryControllers.deleteCategory);
router.post(
  "/add-category-offer/:categoryId",
  adminauth,
  categoryControllers.addCategoryOffer
);
router.delete(
  "/remove-category-offer/:categoryId",
  adminauth,
  categoryControllers.removeoffer
);

router.get("/productadd", adminauth, productControllers.productaddpage);
router.post(
  "/productadd",
  adminauth,
  upload.array("productImage", 3),
  productControllers.addProduct
);
router.get("/product", adminauth, productControllers.productPage);
router.get("/productsblock", adminauth, productControllers.blockproduct);
router.get("/productsunblock", adminauth, productControllers.unblockproduct);
router.get("/editproduct", adminauth, productControllers.editproduct);
router.post(
  "/editproduct/:id",
  adminauth,
  upload.array("productImage", 3),
  (req, res) => {
    const productId = req.params.id; // Use req.params.id for route parameters
    console.log("Product ID:", productId); // Debugging: Check if the ID is correct
    if (!productId) {
      return res.status(400).send("Product ID is missing");
    }
    // Call the controller function
    productControllers.seteditproduct(req, res);
  }
);
router.post("/deleteimage", adminauth, productControllers.deleteimage);
router.post(
  "/add-product-offer/:productId",
  adminauth,
  productControllers.addProductOffer
);
router.delete(
  "/remove-product-offer/:productId",
  adminauth,
  productControllers.deleteoffer
);

router.get("/orders", adminauth, orderControllers.listOrders);
router.get("/orders/:id", adminauth, orderControllers.viewOrder);
router.post("/update-status", adminauth, orderControllers.updateOrderStatus);
router.post(
  "/handle-return-request",
  adminauth,
  orderControllers.handleReturnRequest
);
router.post(
  "/singlehandle-return-request",
  adminauth,
  orderControllers.singlehandleReturnRequest
);
router.post(
  "/update-item-status",
  adminauth,
  orderControllers.updateItemStatus
);

router.get("/coupon", adminauth, couponControllers.loadCoupon);
router.post("/add-coupon", adminauth, couponControllers.addCoupon);
router.post("/unlist-coupon/:id", adminauth, couponControllers.unlistCoupon);
router.post("/list-coupon/:id", adminauth, couponControllers.listCoupon);
router.post("/edit-coupon/:id", adminauth, couponControllers.editCoupon);
router.delete("/delete-coupon/:id", adminauth, couponControllers.deleteCoupon);

router.get("/salesreport", adminauth, salesreportControllers.loadsalesreport);
router.get("/sales-report/pdf", adminauth, salesreportControllers.salespdf);
router.get(
  "/download-sales-report-excel",
  salesreportControllers.downloadSalesReportExcel
);

router.get("/wallet", adminauth, walletControllers.loadwallet);
module.exports = router;
