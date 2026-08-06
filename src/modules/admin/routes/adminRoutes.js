const router = require('express').Router();
const controller = require('../controllers/adminController');
const superAdminAuth = require('../../../common/middlewares/superAdminAuth');
const { authLimiter } = require('../../../common/middlewares/rateLimiter');

// Existing routes
router.post('/login', authLimiter, controller.login);
router.get('/bookings', superAdminAuth, controller.getBookings);
router.get('/booking/:id', superAdminAuth, controller.getBookingById);

// Category routes
router.get('/categories', superAdminAuth, controller.getCategories);
router.post('/categories', superAdminAuth, controller.createCategory);
router.put('/categories/:id', superAdminAuth, controller.updateCategory);
router.delete('/categories/:id', superAdminAuth, controller.deleteCategory);

// Subcategory routes
router.get('/subcategories', superAdminAuth, controller.getSubcategories);
router.post('/subcategories', superAdminAuth, controller.createSubcategory);
router.put('/subcategories/:id', superAdminAuth, controller.updateSubcategory);
router.delete('/subcategories/:id', superAdminAuth, controller.deleteSubcategory);

module.exports = router;