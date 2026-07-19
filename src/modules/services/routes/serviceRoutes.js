const router = require('express').Router();
const serviceController = require('../controllers/serviceController');

// Static/prefixed paths must be declared before the catch-all `/:serviceId`.
router.get('/', serviceController.listServices);
router.get('/categories/list', serviceController.getCategories);
router.get('/categories/:categoryId', serviceController.getCategoryWithSubcategories);
router.get('/products/category/:categoryId', serviceController.getServicesByCategory);
router.get('/products/subcategory/:subcategoryId', serviceController.getServicesBySubcategory);
router.get('/:serviceId', serviceController.getServiceDetail);

module.exports = router;
