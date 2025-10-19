// controllers/order.controller.js
const Order = require('../models/Order.model');
const Product = require('../models/Product.model');
const Cart = require('../models/Cart.model');
const ApiResponse = require('../utils/ApiResponse');

// @desc    Create new order
// @route   POST /api/orders
// @access  Private
exports.createOrder = async (req, res, next) => {
  try {
    const { items, shippingAddress, paymentMethod } = req.body;

    if (!items || items.length === 0) {
      return ApiResponse.error(res, 'No items in order', 400);
    }

    if (!shippingAddress) {
      return ApiResponse.error(res, 'Shipping address is required', 400);
    }

    // Group items by vendor
    const vendorGroups = {};
    let totalAmount = 0;

    for (const item of items) {
      const product = await Product.findById(item.product);
      if (!product || !product.isActive) {
        return ApiResponse.error(res, `Product ${item.product} not found`, 404);
      }

      if (!product.isInStock(item.quantity)) {
        return ApiResponse.error(res, `Insufficient stock for ${product.name}`, 400);
      }

      const vendorId = product.vendor.toString();
      if (!vendorGroups[vendorId]) {
        vendorGroups[vendorId] = [];
      }

      const itemTotal = product.price * item.quantity;
      vendorGroups[vendorId].push({
        product: item.product,
        quantity: item.quantity,
        unitPrice: product.price,
        totalPrice: itemTotal
      });

      totalAmount += itemTotal;
    }

    // Create orders for each vendor
    const orders = [];
    for (const [vendorId, vendorItems] of Object.entries(vendorGroups)) {
      const vendorTotal = vendorItems.reduce((sum, item) => sum + item.totalPrice, 0);

      const order = await Order.create({
        customer: req.user._id,
        vendor: vendorId,
        items: vendorItems,
        totalAmount: vendorTotal,
        shippingAddress,
        paymentMethod: paymentMethod || 'cash_on_delivery'
      });

      // Reduce stock for each product
      for (const item of vendorItems) {
        const product = await Product.findById(item.product);
        await product.reduceStock(item.quantity);
      }

      orders.push(order);
    }

    // Clear cart after order
    await Cart.findOneAndUpdate(
      { user: req.user._id },
      { items: [] }
    );

    ApiResponse.success(res, orders, 'Order placed successfully', 201);
  } catch (error) {
    next(error);
  }
};

// @desc    Get user orders
// @route   GET /api/orders
// @access  Private
exports.getMyOrders = async (req, res, next) => {
  try {
    const orders = await Order.find({ customer: req.user._id })
      .populate('vendor', 'fullName email phone')
      .populate('items.product', 'name imageUrl')
      .sort({ createdAt: -1 });

    ApiResponse.success(res, orders);
  } catch (error) {
    next(error);
  }
};

// @desc    Get single order
// @route   GET /api/orders/:id
// @access  Private
exports.getOrder = async (req, res, next) => {
  try {
    const order = await Order.findById(req.params.id)
      .populate('customer', 'fullName email phone')
      .populate('vendor', 'fullName email phone')
      .populate('items.product', 'name imageUrl price');

    if (!order) {
      return ApiResponse.error(res, 'Order not found', 404);
    }

    // Check if user is customer or vendor of this order
    if (
      order.customer._id.toString() !== req.user._id.toString() &&
      order.vendor._id.toString() !== req.user._id.toString() &&
      req.user.role !== 'admin'
    ) {
      return ApiResponse.error(res, 'Not authorized', 403);
    }

    ApiResponse.success(res, order);
  } catch (error) {
    next(error);
  }
};

// @desc    Update order status
// @route   PUT /api/orders/:id/status
// @access  Private (Vendor only)
exports.updateOrderStatus = async (req, res, next) => {
  try {
    const { status } = req.body;
    const validStatuses = ['pending', 'processing', 'shipped', 'delivered', 'cancelled'];

    if (!validStatuses.includes(status)) {
      return ApiResponse.error(res, 'Invalid status', 400);
    }

    const order = await Order.findById(req.params.id);
    if (!order) {
      return ApiResponse.error(res, 'Order not found', 404);
    }

    // Check if user is the vendor of this order
    if (order.vendor.toString() !== req.user._id.toString() && req.user.role !== 'admin') {
      return ApiResponse.error(res, 'Not authorized', 403);
    }

    order.status = status;
    await order.save();

    ApiResponse.success(res, order, 'Order status updated');
  } catch (error) {
    next(error);
  }
};