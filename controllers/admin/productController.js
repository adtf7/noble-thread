const products = require('../../models/productSchema');
const fs = require('fs');
const path = require('path');
const User = require('../../models/userschema');
const sharp = require('sharp');
const category = require('../../models/categorySchema');
const mongoose = require('mongoose');
const Offer=require('../../models/offerSchema')


let productaddpage = async (req, res) => {
    try {
        if(req.session.admin){
        let cat = await category.find({ isListed: true });
        let productData = await products.find().populate('category');
        res.render('admin/add-product', { currentPage: 'add-product', categories: cat, products: productData });}
        else{
           return redirect('/admin/admin-login')
        }
    } catch (error) {
        console.log('Error loading products page', error);
        res.status(500).redirect('/admin/pageerror');
    }
};

let addProduct = async (req, res)    => {
    try {
        let product = req.body;
        if(!product){
            res.json('fields are required')
        }
        console.log(product);
        let productexisted = await products.findOne({
            productName: product.productName
        });

        if (!productexisted) {
            let images = [];
            if (req.files && req.files.length > 0) {
                for (let i = 0; i < req.files.length; i++) {
                    let originalimagepath = req.files[i].path;
                    let resizeimagepath = path.join(__dirname, '../../public/uploads/product-image', Date.now() + '-' + req.files[i].originalname);
                    
                    const dir = path.dirname(resizeimagepath);
                    if (!fs.existsSync(dir)) {
                        fs.mkdirSync(dir, { recursive: true });
                    }

                    await sharp(originalimagepath).resize({ width: 440, height: 440 }).toFile(resizeimagepath);
                    images.push(resizeimagepath.replace(path.join(__dirname, '../../public'), ''));
                }
            }

            let newproducts = new products({
                productName: product.productName,
                description: product.description,
                category: product.category, 
                salePrice: product.salePrice,
                regularPrice: product.regularPrice,
                createdAt: new Date(),
                quantity: product.quantity,
                size: product.size,
                color: product.color,
                productImage: images,
                status: 'Available',
            });
            await newproducts.save();
            return res.redirect('/admin/product');
        } else {
            return res.status(404).json({ status: false, message: "Product already exist" });
        }
    } catch (error) {
        console.log('Error adding products ', error);
        res.status(500).redirect('/admin/pageerror');
    }
};

let productPage = async (req, res) => {
    try {
     
        let { page = 1, limit = 4, search = '', category: selectedCategory = "" } = req.query;
        page = parseInt(page);
        limit = parseInt(limit);

 
        if (isNaN(page) || page < 1) page = 1;
        if (isNaN(limit) || limit < 1) limit = 4;


        let cat = await category.find({});


        let searchQuery = {};
        if (search) {
            searchQuery.productName = { $regex: search, $options: 'i' };
        }

    
        let filter = { ...searchQuery }; 
        if (selectedCategory) {
            filter.category = selectedCategory;
        }

 
        const totalProducts = await products.countDocuments(filter);
        const totalPages = Math.ceil(totalProducts / limit);

        
        const productsData = await products.find(filter)
            .populate('category')
            .populate('offer') 
            .sort({ createdAt: -1 }) 
            .skip((page - 1) * limit) 
            .limit(limit); 

     console.log(productsData.category)
        res.render('admin/product', {
            currentPage: 'products',
            totalPages: totalPages,
            products: productsData,
            search: search,
            categories: cat,
            selectedCategory,
            page,
            totalProducts,
        });
    } catch (error) {
        console.error('Error loading products page:', error.message);
        console.error(error.stack); 
        res.status(500).redirect('/admin/pageerror');
    }
};

let blockproduct = async (req, res) => {
    try {
        let id = req.query.id;
        console.log(id);
        await products.findOneAndUpdate({_id: id}, {$set: {isBlocked: true}});
        res.redirect('/admin/product');
    } catch (error) {
        res.redirect('/admin/pageerror');
        console.log('error while blocking product', error);
    }
};

let unblockproduct = async (req, res) => {
    try {
        let id = req.query.id;
        console.log(id);
        await products.findOneAndUpdate({_id: id}, {$set: {isBlocked: false}});
        res.redirect('/admin/product');
    } catch (error) {
        res.redirect('/admin/pageerror');
        console.log('error while unblocking product', error);
    }
};

let editproduct=async(req,res)=>{
    try {
        let id=req.query.id
        let product=await products.findOne({_id:id})
        let cat=await category.find({})
        res.render('admin/edit-product',{
          product: product,
            categories:cat,
            currentPage:''
      })
    } catch (error) {
        res.redirect('/admin/pageerror');
        console.log('error while edit product loading', error); 
    }
}


let seteditproduct = async (req, res) => {
    try {
        let id = req.params.id; 
        if (!mongoose.Types.ObjectId.isValid(id)) {
            return res.status(400).json({ status: false, message: "Invalid product ID" });
        }

        let product = await products.findById(id).lean(); 
        console.log("Product ID:", id);

        if (!product) {
            return res.status(404).json({ status: false, message: "Product not found" });
        }

        let data = req.body;

   
        let existingProduct = await products.findOne({
            productName: data.productName,
            _id: { $ne: new mongoose.Types.ObjectId(id) }
        });

        if (existingProduct) {
            return res.status(400).json({ status: false, message: "Product already exists" });
        }

        let images = [];

        if (req.files && req.files.length > 0) {
            for (let i = 0; i < req.files.length; i++) {
                let originalImagePath = req.files[i].path;
                let imageName = Date.now() + '-' + req.files[i].originalname;
                let resizedImagePath = path.resolve(__dirname, '../../public/uploads/product-image', imageName);

             
                const dir = path.dirname(resizedImagePath);
                await fs.promises.mkdir(dir, { recursive: true });

                await sharp(originalImagePath)
                    .resize({ width: 440, height: 440 })
                    .toFile(resizedImagePath);

                images.push(`/uploads/product-image/${imageName}`); 
            }
        }

    
        let updateFields = {
            productName: data.productName || product.productName,
            description: data.description || product.description,
            category: data.category ? (mongoose.Types.ObjectId.isValid(data.category) ? new mongoose.Types.ObjectId(data.category) : product.category) : product.category,
            regularPrice: data.regularPrice || product.regularPrice,
            salePrice: data.salePrice || product.salePrice,
            quantity: data.quantity || product.quantity,
            size: data.size || product.size,
            color: data.color || product.color,
            status: 'Available',
        };


        let updateQuery = { $set: updateFields };
        if (images.length > 0) {
            updateQuery.$addToSet = { productImage: { $each: images } };
        }

        await products.findByIdAndUpdate(id, updateQuery, { new: true });

       return res.json({ success: true, message: "Product updated successfully" });

    } catch (error) {
        console.error("Error while editing product:", error);
        res.status(500).json({ status: false, error: "Internal Server Error" });
    }
};

const deleteimage = async (req, res) => {
    try {
        const { imageNameToServer, productIdToServer } = req.body;

        if (!imageNameToServer || !productIdToServer) {
            return res.status(400).json({ status: false, error: "Invalid request data" });
        }

        const product = await products.findById(productIdToServer);

        if (!product) {
            return res.status(404).json({ status: false, error: "Product not found" });
        }


        if (product.productImage[0] === imageNameToServer) {
            return res.status(400).json({ status: false, error: "Cannot delete the 0th image" });
        }

    
        const updatedProduct = await products.findByIdAndUpdate(
            productIdToServer,
            { $pull: { productImage: imageNameToServer } },
            { new: true }
        );

    
        const imagePath = path.join(__dirname, '../public/uploads/product-image', imageNameToServer);

        console.log(`Deleting Image: ${imagePath}`);

        fs.unlink(imagePath, (err) => {
            if (err) {
                console.warn(`Image not found or error deleting: ${err.message}`);
                return res.json({ status: true, message: "Image reference removed, but file not found." });
            }
            console.log(` Image deleted: ${imageNameToServer}`);
            res.json({ status: true, message: "Image deleted successfully", updatedProduct: updatedProduct });
        });

    } catch (error) {
        console.error('Error while deleting image:', error);
        res.status(500).json({ status: false, error: "Internal Server Error" });
    }
};

  let addProductOffer=async(req,res)=>{

    const { productId } = req.params;
    const { discountPercentage, startDate, endDate } = req.body;
console.log('body',req.body);
console.log("params", req.params);
    try {
   
        const product = await products.findById(productId);
        if (!product) {
            return res.status(404).json({ success: false, message: 'Product not found' });
        }
           const expireDate = new Date(endDate);
              expireDate.setHours(23, 59, 59, 999); 

        const offer = new Offer({
            type: 'product',
            productId,
            discountPercentage,
            startDate,
            endDate:expireDate
        });
        await offer.save();

     
        product.offer = offer._id;
        await product.save();

        res.json({ success: true, message: 'Product offer added successfully', data: offer });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
  }

  let deleteoffer=async(req,res)=>{

    const { productId } = req.params;

    try {
        const product = await products.findById(productId);
        if (!product) {
            return res.status(404).json({ success: false, message: 'Product not found' });
        }

        if (!product.offer) {
            return res.status(400).json({ success: false, message: 'No offer found for this product' });
        }

        await Offer.findByIdAndDelete(product.offer);
        product.offer = null;
        await product.save();

        res.json({ success: true, message: 'Product offer removed successfully' });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
  }


module.exports = {
    productaddpage,
    addProduct,
    productPage,
    blockproduct,
    unblockproduct,
    editproduct,
    seteditproduct,
    deleteimage,
    addProductOffer,
    deleteoffer
};
