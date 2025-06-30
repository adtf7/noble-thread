const errorHandler = (err, req, res, next) => {
    console.error(" Error caught by errorHandler middleware:", err);

    // Set the status code
    const statusCode = err.status || 500;

    // Send a JSON response for API routes
    if (req.originalUrl.startsWith('/api')) {
        return res.status(statusCode).json({
            success: false,
            message: err.message || "Internal Server Error",
        });
    }

    // Render an error page for non-API routes
    res.status(statusCode).render('error', {
        title: "Error",
        message: err.message || "Something went wrong!",
        statusCode,
    }); 
};

module.exports = errorHandler;