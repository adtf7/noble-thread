let loadHomePage = async (req, res) => {
    try {
        return res.render('user/home');
    } catch (error) {
        console.error('Error on home:', error.message);
        res.status(500).render('error', { message: 'Internal Server Error' });
    }
};
let pagenotfound = async (req, res) => {
    try {
        res.status(404).render('user/page-404'); 
    } catch (error) {
        console.error('Error loading 404 page:', error.message);
        res.redirect('/');
    }
};


module.exports = {
    loadHomePage,
    pagenotfound
};
