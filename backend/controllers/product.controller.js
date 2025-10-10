const Product = require('../models/Product.model');
const ApiResponse = require('../utils/ApiResponse');

// @desc    Get all products with filters & pagination
// @route   GET /api/products
// @access  Public
exports.getProducts = async (req, res, next) => {
  try {
    const {
      page = 1,
      limit = 12,
      category,
      search,
      minPrice,
      maxPrice,
      sortBy = 'createdAt',
      order = 'desc',
      vendor
    } = req.query;

    // Build query
    const query = { isActive: true };

    // Filter by category
    if (category) {
      query.category = category;
    }

    // Filter by vendor
    if (vendor) {
      query.vendor = vendor;
    }

    // Search in name and description
    if (search) {
      query.$text = { $search: search };
    }

    // Price range filter
    if (minPrice || maxPrice) {
      query.price = {};
      if (minPrice) query.price.$gte = Number(minPrice);
      if (maxPrice) query.price.$lte = Number(maxPrice);
    }

    // Calculate pagination
    const skip = (page - 1) * limit;

    // Get total count
    const total = await Product.countDocuments(query);

    // Sort options
    const sortOptions = {};
    sortOptions[sortBy] = order === 'asc' ? 1 : -1;

    // Execute query
    const products = await Product.find(query)
      .populate('vendor', 'fullName email')
      .populate('category', 'name slug')
      .sort(sortOptions)
      .skip(skip)
      .limit(Number(limit));

    ApiResponse.paginated(res, products, Number(page), Number(limit), total);
  } catch (error) {
    next(error);
  }
};

// @desc    Get single product by ID
// @route   GET /api/products/:id
// @access  Public
exports.getProduct = async (req, res, next) => {
  try {
    const product = await Product.findById(req.params.id)
      .populate('vendor', 'fullName email phone')
      .populate('category', 'name slug description')
      .populate({
        path: 'reviews',
        populate: {
          path: 'user',
          select: 'fullName avatarUrl'
        }
      });

    if (!product) {
      return ApiResponse.error(res, 'Product not found', 404);
    }

    // Increment view count
    product.viewCount += 1;
    await product.save();

    ApiResponse.success(res, product);
  } catch (error) {
    next(error);
  }
};

// @desc    Create new product
// @route   POST /api/products
// @access  Private (Vendor only)
exports.createProduct = async (req, res, next) => {
  try {
    const {
      name,
      description,
      price,
      stockQuantity,
      category,
      imageUrl,
      images,
      sku
    } = req.body;

    // Validate required fields
    if (!name || !price || !category) {
      return ApiResponse.error(res, 'Please provide name, price, and category', 400);
    }

    // Create product with vendor ID from authenticated user
    const product = await Product.create({
      vendor: req.user._id,
      name,
      description,
      price,
      stockQuantity: stockQuantity || 0,
      category,
      imageUrl,
      images: images || [],
      sku
    });

    const populatedProduct = await Product.findById(product._id)
      .populate('vendor', 'fullName email')
      .populate('category', 'name slug');

    ApiResponse.success(res, populatedProduct, 'Product created successfully', 201);
  } catch (error) {
    next(error);
  }
};

// @desc    Update product
// @route   PUT /api/products/:id
// @access  Private (Vendor - own products only)
exports.updateProduct = async (req, res, next) => {
  try {
    let product = await Product.findById(req.params.id);

    if (!product) {
      return ApiResponse.error(res, 'Product not found', 404);
    }

    // Check if user is the product owner
    if (product.vendor.toString() !== req.user._id.toString() && req.user.role !== 'admin') {
      return ApiResponse.error(res, 'Not authorized to update this product', 403);
    }

    // Update product
    product = await Product.findByIdAndUpdate(
      req.params.id,
      req.body,
      {
        new: true,
        runValidators: true
      }
    )
      .populate('vendor', 'fullName email')
      .populate('category', 'name slug');

    ApiResponse.success(res, product, 'Product updated successfully');
  } catch (error) {
    next(error);
  }
};

// @desc    Delete product
// @route   DELETE /api/products/:id
// @access  Private (Vendor - own products only)
exports.deleteProduct = async (req, res, next) => {
  try {
    const product = await Product.findById(req.params.id);

    if (!product) {
      return ApiResponse.error(res, 'Product not found', 404);
    }

    // Check if user is the product owner
    if (product.vendor.toString() !== req.user._id.toString() && req.user.role !== 'admin') {
      return ApiResponse.error(res, 'Not authorized to delete this product', 403);
    }

    // Soft delete - set isActive to false
    product.isActive = false;
    await product.save();

    // Or hard delete if preferred:
    // await product.remove();

    ApiResponse.success(res, {}, 'Product deleted successfully');
  } catch (error) {
    next(error);
  }
};

// @desc    Get featured/trending products
// @route   GET /api/products/featured
// @access  Public
exports.getFeaturedProducts = async (req, res, next) => {
  try {
    const limit = Number(req.query.limit) || 8;

    const products = await Product.find({ isActive: true })
      .sort({ averageRating: -1, soldCount: -1 })
      .limit(limit)
      .populate('vendor', 'fullName')
      .populate('category', 'name slug');

    ApiResponse.success(res, products);
  } catch (error) {
    next(error);
  }
};