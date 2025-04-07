let coupon = require("../../models/couponSchema");
let user = require("../../models/cartSchema");
let order = require("../../models/orderSchema");
let product = require("../../models/productSchema");
let category = require("../../models/categorySchema");
let cart = require("../../models/cartSchema");

const loadCoupon = async (req, res) => {
  try {
   
      const couponsPerPage = 5;
      const page = parseInt(req.query.page) || 1; 
 

      if (isNaN(page) || page < 1) {
          return res.status(400).send("Invalid page number");
      }


      const coupons = await coupon.find()
          .sort({createdOn: -1})
          .skip((page - 1) * couponsPerPage)
          .limit(couponsPerPage);

    
      const totalCoupons = await coupon.countDocuments();

     
      const totalPages = Math.ceil(totalCoupons / couponsPerPage);


      res.render("admin/coupon", {
          coupons,
          totalCoupons,
          currentPage: "coupon",
          page,
          totalPages,
      });
  } catch (error) {
      console.error('Error in loadCoupon:', error);
      res.status(500).send("Internal Server Error");
  }
};
  
const addCoupon = async (req, res) => {
  try {
      const { name, expire_on, offer_price, minimum_price, max_discount, is_list } = req.body;

      if (!name || !expire_on || !offer_price || !minimum_price || !max_discount) {
          return res.status(400).json({ success: false, message: "All fields are required." });
      }

      // Validate percentages (0-100)
      if (offer_price < 0 || offer_price > 100 || minimum_price < 0 || minimum_price > 100 || max_discount < 0 || max_discount > 100) {
          return res.status(400).json({ success: false, message: "All percentage fields must be between 0 and 100." });
      }

      // Ensure max_discount >= offer_price (both are percentages)
      if (max_discount < offer_price) {
          return res.status(400).json({ success: false, message: "Maximum Discount (%) must be greater than or equal to Offer Price (%)." });
      }

      const existingCoupon = await coupon.findOne({ name });
      if (existingCoupon) {
          return res.status(400).json({ success: false, message: "Coupon name already exists." });
      }

      const newCoupon = new coupon({
          name,
          expireOn: expire_on, 
          offerPrice: offer_price, 
          minimumPrice: minimum_price, 
          maxDiscount: max_discount,  
          isList: is_list || true, 
      });

      await newCoupon.save();

      res.status(201).json({ success: true, message: "Coupon created successfully.", data: newCoupon });
  } catch (error) {
      console.error("Error creating coupon:", error);
      res.status(500).json({ success: false, message: "Server error while creating coupon. Try again later." });
  }
};
 
  const unlistCoupon = async (req, res) => {
    try {
      const { id } = req.params;
  
      const couponToUnlist = await coupon.findById(id);
      if (!couponToUnlist) {
        return res.status(404).json({ success: false, message: "Coupon not found." });
      }
  
    
      couponToUnlist.isList = false;
      await couponToUnlist.save();
  
      // Return success response
      res.status(200).json({ success: true, message: "Coupon unlisted successfully.", data: couponToUnlist });
    } catch (error) {
      console.error("Error unlisting coupon:", error);
      res.status(500).json({ success: false, message: "Server error while unlisting coupon. Try again later." });
    }
  };
  const listCoupon = async (req, res) => {
    try {
      const { id } = req.params;
  
      const couponToList = await coupon.findById(id);
      if (!couponToList) {
        return res.status(404).json({ success: false, message: "Coupon not found." });
      }
  
      couponToList.isList = true;
      await couponToList.save();
  
      res.status(200).json({ success: true, message: "Coupon listed successfully.", data: couponToList });
    } catch (error) {
      console.error("Error listing coupon:", error);
      res.status(500).json({ success: false, message: "Server error while listing coupon. Try again later." });
    }
  };

  const editCoupon = async (req, res) => {
    try {
        const { id } = req.params;
        const { name, expireOn, offerPrice, minimumPrice, maxDiscount, isList } = req.body;

        if (!name || !expireOn || !offerPrice || !minimumPrice || !maxDiscount) {
            return res.status(400).json({ success: false, message: "All fields are required" });
        }

        // Validate percentages (0-100)
        if (offerPrice < 0 || offerPrice > 100 || 
            minimumPrice < 0 || minimumPrice > 100 || 
            maxDiscount < 0 || maxDiscount > 100) {
            return res.status(400).json({ 
                success: false, 
                message: "All percentage fields must be between 0 and 100." 
            });
        }

        // Ensure maxDiscount >= offerPrice
        if (maxDiscount < offerPrice) {
            return res.status(400).json({ 
                success: false, 
                message: "Maximum Discount must be greater than or equal to Offer Price." 
            });
        }

        const existingCoupon = await coupon.findOne({ name, _id: { $ne: id } });
        if (existingCoupon) {
            return res.status(400).json({ 
                success: false, 
                message: "Coupon name already exists." 
            });
        }

        const updateCoupon = await coupon.findByIdAndUpdate(
            id,
            { 
                name, 
                expireOn, 
                offerPrice, 
                minimumPrice, 
                maxDiscount,
                isList
            },
            { new: true }
        );

        if (updateCoupon) {
            return res.status(200).json({
                success: true,
                message: "Coupon updated successfully.",
                data: updateCoupon,
            });
        } else {
            return res.status(404).json({
                success: false,
                message: "Coupon not found."
            });
        }
    } catch (error) {
        console.error("Error updating coupon:", error);
        res.status(500).json({ 
            success: false, 
            message: "Server error while updating coupon. Try again later." 
        });
    }
};
  let deleteCoupon=async(req,res)=>{   

    try {
        let {id}=req.params;
        let deleteCoupon = await coupon.findByIdAndDelete(id);
        if(!deleteCoupon){
            return res
              .status(404)
              .json({ success: false, message: "Coupon not found" });
        }
        return res
          .status(200)
          .json({ success: true, message: "Coupon deleted successfully." });

    } catch (error) {
        console.error("Error deleting coupon:", error);
        res.status(500).json({ success: false, message: "Server error while deleting coupon. Try again later." });
  
    }

  }

module.exports = { 
    loadCoupon ,
    addCoupon,
    unlistCoupon,
    listCoupon,
    editCoupon,
    deleteCoupon
};