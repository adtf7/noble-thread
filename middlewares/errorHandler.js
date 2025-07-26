const errorHandler = (err, req, res, next) => {
  console.error(" Error caught by errorHandler middleware:", err);

  const statusCode = err.status || 500;

  if (req.originalUrl.startsWith("/api")) {
    return res.status(statusCode).json({
      success: false,
      message: err.message || "Internal Server Error",
    });
  }

  res.status(statusCode).render("error", {
    title: "Error",
    message: err.message || "Something went wrong!",
    statusCode,
  });
};

module.exports = errorHandler;
