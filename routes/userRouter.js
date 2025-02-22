let express = require('express');
let router = express.Router();
let userController = require('../controllers/user/usercontroller');


router.get('/pagenotfound',userController.pagenotfound)
router.get('/', userController.loadHomePage);

module.exports = router;
