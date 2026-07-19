const router = require('express').Router();
const auth = require('../../../common/middlewares/auth');
const userController = require('../controllers/userController');

router.get('/profile', auth, userController.getProfile);
router.put('/update', auth, userController.updateProfile);

module.exports = router;
