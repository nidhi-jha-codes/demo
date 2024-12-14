import { CookieOptions, Request, Response } from "express";
import jwt, { JwtPayload } from "jsonwebtoken";
import { UploadApiResponse } from "cloudinary";

import asyncHandler from "../utils/asyncHandler";
import {
  loginValidator,
  registerValidator,
} from "../validators/user.validator";
import ApiResponse from "../utils/ApiResponse";
import ApiError from "../utils/ApiError";
import { User, UserRefreshTokenPayload } from "../models/user.model";
import { uploadToCloudinary, deleteFromCloudinary } from "../utils/cloudinary";
import { Profile } from "../models/profile.model";
import logger from "../utils/logger";
import { NODE_ENV, REFRESH_TOKEN_SECRET } from "../constants";

const options: CookieOptions = {
  httpOnly: true,
  secure: NODE_ENV === "production",
};

const generateTokens = async (userId: string) => {
  try {
    const user = await User.findById(userId);

    if (!user) {
      throw new ApiError(404, "User Not Found");
    }

    const accessToken = user.generateAccessToken();
    const refreshToken = user.generateRefreshToken();

    user.refreshToken = refreshToken;
    await user.save({ validateBeforeSave: false });

    return { accessToken, refreshToken };
  } catch (error) {
    logger.error("Error Creating tokens", error);
    throw new ApiError(500, "Error creating Tokens");
  }
};

const registerUser = asyncHandler(async (req: Request, res: Response) => {
  const validatedUser = registerValidator.parse(req.body);

  const { fullName, username, email, password, confirmPassword } =
    validatedUser;

  if (password !== confirmPassword) {
    throw new ApiError(500, "Passwords do not Match");
  }

  const existedUser = await User.findOne({
    $or: [{ username }, { email }],
  });

  if (existedUser) {
    throw new ApiError(409, "User with email or username already exists");
  }

  const files = req.files as
    | { [fieldname: string]: Express.Multer.File[] }
    | undefined;

  let avatarFilePath: string = "";

  if (files && files.avatar && files.avatar.length > 0) {
    avatarFilePath = files.avatar[0].path; // The uploaded file
  }

  let avatar: UploadApiResponse | null = null;

  if (avatarFilePath) {
    avatar = await uploadToCloudinary(avatarFilePath);
  }

  try {
    const user = await User.create({
      fullName,
      username: username.toLowerCase(),
      email,
      password,
    });

    const createdUser = await User.findById(user._id).select(
      "-password -refreshToken",
    );

    if (!createdUser) {
      throw new ApiError(500, "Could not register User");
    }

    const profile = await Profile.create({
      user,
      avatar: avatar ? avatar.url : null,
    });

    const createdProfile = await Profile.findById(profile._id);

    if (!createdProfile) {
      User.findByIdAndDelete(user._id);
      throw new ApiError(500, "Could not create user profile");
    }

    res
      .status(201)
      .json(
        new ApiResponse(
          201,
          validatedUser,
          "User Profile created successfully",
        ),
      );
  } catch (error) {
    logger.error("Could not register User: ", error);

    if (avatar) {
      await deleteFromCloudinary(avatar.public_id);
    }

    throw new ApiError(500, "Could not register User");
  }
});

const loginUser = asyncHandler(async (req: Request, res: Response) => {
  const validatedCredentials = loginValidator.parse(req.body);

  const { usernameOrEmail, password } = validatedCredentials;

  const user = await User.findOne({
    $or: [{ email: usernameOrEmail }, { username: usernameOrEmail }],
  });

  if (!user) {
    throw new ApiError(404, "Invalid Credentials");
  }

  const isPasswordValid = await user.checkPassword(password);

  if (!isPasswordValid) {
    throw new ApiError(401, "Invalid Credentials");
  }

  const { accessToken, refreshToken } = await generateTokens(
    user._id.toString(),
  );

  const loggedInUser = await User.findById(user._id).select(
    "-password -refreshToken -createdAt -updatedAt -__v",
  );

  if (!loggedInUser) {
    throw new ApiError(500, "Could not Login user");
  }

  res
    .status(200)
    .cookie("accessToken", accessToken, options)
    .cookie("refreshToken", refreshToken, options)
    .json(
      new ApiResponse(
        200,
        { user: loggedInUser, accessToken, refreshToken },
        "User Logged in Successfully",
      ),
    );
});

const logoutUser = asyncHandler(async (req: Request, res: Response) => {
  await User.findByIdAndUpdate(
    req.user?._id,
    {
      $set: {
        refreshToken: undefined,
      },
    },
    { new: true },
  );

  res
    .status(200)
    .clearCookie("accessToken", options)
    .clearCookie("refreshToken", options)
    .json(new ApiResponse(200, {}, "User Logged Out successfully"));
});

const refreshAccessToken = asyncHandler(async (req: Request, res: Response) => {
  const incomingRefreshToken =
    req.cookies.refreshToken || req.body.refreshToken;

  if (!incomingRefreshToken) {
    throw new ApiError(401, "Refresh Token is required");
  }

  try {
    const decodedToken = jwt.verify(
      incomingRefreshToken,
      REFRESH_TOKEN_SECRET!,
    ) as UserRefreshTokenPayload;

    const user = await User.findById(decodedToken?._id!);

    if (!user) {
      throw new ApiError(404, "Invalid Refresh Token");
    }

    if (incomingRefreshToken !== user.refreshToken) {
      throw new ApiError(404, "Invalid Refresh Token");
    }

    const { accessToken, refreshToken: newRefreshToken } = await generateTokens(
      user.id,
    );

    res
      .status(200)
      .cookie("accessToken", accessToken, options)
      .cookie("refreshToken", newRefreshToken, options)
      .json(
        new ApiResponse(
          200,
          { accessToken, refreshToken: newRefreshToken },
          "Access Token refreshed Successfully",
        ),
      );
  } catch (error) {}
});

export { registerUser, loginUser, logoutUser, refreshAccessToken };
