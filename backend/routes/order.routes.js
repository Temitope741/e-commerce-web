const express = require('express');
const router = express.Router();
const {
  createOrder,
  getMyOrders,
  getOrder,
  updateOrderStatus
} = require('../controllers/order.controller');
const { protect } = require('../middleware/auth.middleware');
const { isVendor } = require('../middleware/roleCheck.middleware');

router.use(protect); // All order routes require authentication

router.post('/', createOrder);
router.get('/', getMyOrders);
router.get('/:id', getOrder);
router.put('/:id/status', isVendor, updateOrderStatus);

module.exports = router;