function errorHandler(error, req, res, next) {
    console.error(error);
  
    res.status(error.status || 500).json({
      success: false,
      message: error.message || "Internal server error"
    });
  }
  
  module.exports = errorHandler;