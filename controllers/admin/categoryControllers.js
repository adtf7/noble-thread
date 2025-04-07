const category = require('../../models/categorySchema');
const product = require('../../models/productSchema');
const Offer=require('../../models/offerSchema')

let categoryinfo = async (req, res) => {
    try {
        let page = parseInt(req.query.page) || 1;
        let limit = 4;
        let skip = (page - 1) * limit;
        let search = req.query.searchCategory || ""; 

        let categoryData = await category.find({
            name: { $regex: search, $options: 'i' }
        })
        .populate('offer')
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit);

        let totalCategories = await category.countDocuments({
            name: { $regex: search, $options: 'i' }
        });

        let totalPages = Math.ceil(totalCategories / limit);

        res.render('admin/category', {
            cat: categoryData,
            currentPage: 'category',
            totalPages: totalPages,
            totalCategories: totalCategories,
            search: search,
            page,
            limit
        });

    } catch (error) {
        console.log('error on category', error);
        res.status(500).redirect('/admin/pageerror');
    }
};

const addcategory = async (req, res) => {
    try {
        let { name, description } = req.body;

 
        let normalizedCategoryName = name.trim().toLowerCase();

   
        let existingCategory = await category.findOne({ name: { $regex: `^${normalizedCategoryName}$`, $options: "i" } });

        if (existingCategory) {
            return res.status(400).json({ success: false, error: "Category name already exists!" });
        }


        let newCategory = new category({ name: normalizedCategoryName, description });
        await newCategory.save();

        return res.json({ success: true, message: "Category added successfully" });

    } catch (error) {
        console.error("Error adding category:", error);

        if (!res.headersSent) {
            return res.status(500).json({ success: false, error: "Internal Server Error" });
        }
    }
};

const listcategory = async (req, res) => {
    try {
        let id = req.query.id;
        
       
        await category.updateOne({ _id: id }, { $set: { isListed: false } });

   
        await product.updateMany({ category: id }, { $set: { isBlocked: true } });

        res.redirect('/admin/category');
    } catch (error) {
        console.error("Error listing category:", error);
        res.status(500).render('admin/pageerror'); 
    }
};

const unlistcategory = async (req, res) => {
    try {
        let id = req.query.id;

  
        await category.updateOne({ _id: id }, { $set: { isListed: true } });

       
        await product.updateMany({ category: id }, { $set: { isBlocked: false } });

        res.redirect('/admin/category');
    } catch (error) {
        console.error("Error unlisting category:", error);
        res.status(500).render('admin/pageerror'); 
    }
};

let editcategory = async (req, res) => {
    try {
        let id = req.query.id;
        let categoryData = await category.findOne({ _id: id });
        res.render('admin/editcategory', { category: categoryData });
    } catch (error) {
        console.error("Error loading edit category page:", error);
        res.status(500).render('admin/pageerror'); 
    }
};

let seteditcategory = async (req, res) => {
    try {
        let id = req.params.id;
        let { name, description } = req.body;

        console.log(name);
        console.log(description);

        let existingCategory = await category.findOne({ name: name });

        if (existingCategory && existingCategory._id.toString() !== id) {
            return res.status(400).json({ message: "The category name already exists" });
        }

        let categoryUpdate = await category.findByIdAndUpdate(
            id,
            { $set: { name: name, description: description } },
            { new: true }
        );

        if (categoryUpdate) {
            return res.json({ success: true, message: "Category updated successfully" }); 
        } else {
            return res.status(404).json({ error: "Category not found" });
        }

    } catch (error) {
        console.error("Error updating category:", error);
        res.status(500).json({ error: "Internal Server Error" }); 
    }
};
const deleteCategory = async (req, res) => {
    try {
        let id = req.params.id;

        let deletedCategory = await category.findByIdAndDelete(id);

        if (deletedCategory) {
            return res.json({ success: true, message: "Category deleted successfully" });
        } else {
            return res.status(404).json({ error: "Category not found" });
        }
    } catch (error) {
        console.error("Error deleting category:", error);
        res.status(500).json({ error: "Internal Server Error" });
    }
};
 
  let addCategoryOffer=async(req,res)=>{

    const { categoryId } = req.params;
    const { discountPercentage, startDate, endDate } = req.body;

    try {
     
        const Category = await category.findById(categoryId);
        if (!Category) {
            return res.status(404).json({ success: false, message: 'Category not found' });
        }

   
        const offer = new Offer({
            type: 'category',
            categoryId,
            discountPercentage,
            startDate,
            endDate,
        });
        await offer.save();

       
        Category.offer = offer._id;
        await Category.save();

        res.json({ success: true, message: 'Category offer added successfully', data: offer });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
  }
  
  let removeoffer=async(req,res)=>{
    const { categoryId } = req.params;

    try {
        const Category = await category.findById(categoryId);
        if (!Category) {
            return res.status(404).json({ success: false, message: 'Category not found' });
        }

        if (!Category.offer) {
            return res.status(400).json({ success: false, message: 'No offer found for this category' });
        }

        await Offer.findByIdAndDelete(Category.offer);
        Category.offer = null;
        await Category.save();

        res.json({ success: true, message: 'Category offer removed successfully' });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
  }


module.exports = {
    categoryinfo,
    addcategory,
    listcategory,
    unlistcategory,
    editcategory,
    seteditcategory,
    deleteCategory,
    addCategoryOffer,
    removeoffer
};