// controllers/vendor.controller.js
const Product = require('../models/Product.model');
const Order = require('../models/Order.model');
const ApiResponse = require('../utils/ApiResponse');

// @desc    Get vendor dashboard stats
// @route   GET /api/vendor/dashboard
// @access  Private (Vendor only)
exports.getDashboardStats = async (req, res, next) => {
  try {
    // Total products
    const totalProducts = await Product.countDocuments({
      vendor: req.user._id,
      isActive: true
    });

    // Total orders
    const totalOrders = await Order.countDocuments({
      vendor: req.user._id
    });

    // Pending orders
    const pendingOrders = await Order.countDocuments({
      vendor: req.user._id,
      status: 'pending'
    });

    // Total revenue
    const revenueResult = await Order.aggregate([
      {
        $match: {
          vendor: req.user._id,
          paymentStatus: 'paid'
        }
      },
      {
        $group: {
          _id: null,
          totalRevenue: { $sum: '$totalAmount' }
        }
      }
    ]);

    const totalRevenue = revenueResult.length > 0 ? revenueResult[0].totalRevenue : 0;

    // Recent orders
    const recentOrders = await Order.find({ vendor: req.user._id })
      .populate('customer', 'fullName email')
      .sort({ createdAt: -1 })
      .limit(5);

    // Low stock products
    const lowStockProducts = await Product.find({
      vendor: req.user._id,
      isActive: true,
      stockQuantity: { $lt: 10, $gt: 0 }
    })
      .sort({ stockQuantity: 1 })
      .limit(5);

    const stats = {
      totalProducts,
      totalOrders,
      pendingOrders,
      totalRevenue,
      recentOrders,
      lowStockProducts
    };

    ApiResponse.success(res, stats);
  } catch (error) {
    next(error);
  }
};

// @desc    Get vendor products
// @route   GET /api/vendor/products
// @access  Private (Vendor only)
exports.getVendorProducts = async (req, res, next) => {
  try {
    const { page = 1, limit = 10 } = req.query;
    const skip = (page - 1) * limit;

    const total = await Product.countDocuments({ vendor: req.user._id });

    const products = await Product.find({ vendor: req.user._id })
      .populate('category', 'name')
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(Number(limit));

    ApiResponse.paginated(res, products, Number(page), Number(limit), total);
  } catch (error) {
    next(error);
  }
};

// @desc    Get vendor orders
// @route   GET /api/vendor/orders
// @access  Private (Vendor only)
exports.getVendorOrders = async (req, res, next) => {
  try {
    const { page = 1, limit = 10, status } = req.query;
    const skip = (page - 1) * limit;

    const query = { vendor: req.user._id };
    if (status) {
      query.status = status;
    }

    const total = await Order.countDocuments(query);

    const orders = await Order.find(query)
      .populate('customer', 'fullName email phone')
      .populate('items.product', 'name imageUrl')
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(Number(limit));

    ApiResponse.paginated(res, orders, Number(page), Number(limit), total);
  } catch (error) {
    next(error);
  }
};