// Get user profile
exports.getProfile = async (req, res, next) => {
  try {
    const user = await User.findById(req.user._id);

    if (!user) {
      return ApiResponse.error(res, 'User not found', 404);
    }

    ApiResponse.success(res, user);
  } catch (error) {
    next(error);
  }
};

// Update user profile
exports.updateProfile = async (req, res, next) => {
  try {
    const { fullName, phone, address, avatarUrl } = req.body;

    const user = await User.findByIdAndUpdate(
      req.user._id,
      { fullName, phone, address, avatarUrl },
      { new: true, runValidators: true }
    );

    ApiResponse.success(res, user, 'Profile updated');
  } catch (error) {
    next(error);
  }
};

// Delete user account
exports.deleteAccount = async (req, res, next) => {
  try {
    const user = await User.findById(req.user._id);

    if (!user) {
      return ApiResponse.error(res, 'User not found', 404);
    }

    // Soft delete
    user.isActive = false;
    await user.save();

    res.cookie('token', 'none', {
      expires: new Date(Date.now() + 10 * 1000),
      httpOnly: true
    });

    ApiResponse.success(res, {}, 'Account deleted');
  } catch (error) {
    next(error);
  }
};