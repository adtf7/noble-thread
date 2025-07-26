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
router.use('/admin',adminauth)
router.get("/dashboard",  dashboardControllers.loadDashboard);

router.get("/customers",  userControllers.customer);
router.get("/block-user",  userControllers.blockuser);
router.get("/unblock-user",  userControllers.unblockuser);

router.get("/category",  categoryControllers.categoryinfo);
router.post("/add-category",  categoryControllers.addcategory);
router.get("/listcategory",  categoryControllers.listcategory);
router.get("/unlistcategory",  categoryControllers.unlistcategory);
router.get("/categoryedit",  categoryControllers.editcategory);
router.post(
  "/categoryedit/:id",
  
  categoryControllers.seteditcategory
);
router.delete("/category/:id",  categoryControllers.deleteCategory);
router.post(
  "/add-category-offer/:categoryId",
  
  categoryControllers.addCategoryOffer
);
router.delete(
  "/remove-category-offer/:categoryId",
  
  categoryControllers.removeoffer
);

router.get("/productadd",  productControllers.productaddpage);
router.post(
  "/productadd",
  
  upload.array("productImage", 3),
  productControllers.addProduct
);
router.get("/product",  productControllers.productPage);
router.get("/productsblock",  productControllers.blockproduct);
router.get("/productsunblock",  productControllers.unblockproduct);
router.get("/editproduct",  productControllers.editproduct);
router.post(
  "/editproduct/:id",
  
  upload.array("productImage", 3),
  (req, res) => {
    const productId = req.params.id; 
    console.log("Product ID:", productId);
    if (!productId) {
      return res.status(400).send("Product ID is missing");
    }
 
    productControllers.seteditproduct(req, res);
  }
);
router.post("/deleteimage",  productControllers.deleteimage);
router.post(
  "/add-product-offer/:productId",
  
  productControllers.addProductOffer
);
router.delete(
  "/remove-product-offer/:productId",
  
  productControllers.deleteoffer
);

router.get("/orders",  orderControllers.listOrders);
router.get("/orders/:id",  orderControllers.viewOrder);
router.post("/update-status",  orderControllers.updateOrderStatus);
router.post(
  "/handle-return-request",
  
  orderControllers.handleReturnRequest
);
router.post(
  "/singlehandle-return-request",
  
  orderControllers.singlehandleReturnRequest
);
router.post(
  "/update-item-status",
  
  orderControllers.updateItemStatus
);

router.get("/coupon",  couponControllers.loadCoupon);
router.post("/add-coupon",  couponControllers.addCoupon);
router.post("/unlist-coupon/:id",  couponControllers.unlistCoupon);
router.post("/list-coupon/:id",  couponControllers.listCoupon);
router.post("/edit-coupon/:id",  couponControllers.editCoupon);
router.delete("/delete-coupon/:id",  couponControllers.deleteCoupon);

router.get("/salesreport",  salesreportControllers.loadsalesreport);
router.get("/sales-report/pdf",  salesreportControllers.salespdf);
router.get(
  "/download-sales-report-excel",
  salesreportControllers.downloadSalesReportExcel
);

router.get("/wallet",  walletControllers.loadwallet);
module.exports = router;
