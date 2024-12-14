import jwt from "jsonwebtoken";

import { User, UserAccessTokenPayload } from "../models/user.model";
import ApiResponse from "../utils/ApiResponse";
import ApiError from "../utils/ApiError";
import asyncHandler from "../utils/asyncHandler";
import { NextFunction, Request, Response } from "express";
import { ACCESS_TOKEN_SECRET } from "../constants";

const verifyJwt = asyncHandler(
  async (req: Request, res: Response, next: NextFunction) => {
    const token =
      req.cookies.accessToken ||
      req.header("Authorizarion")?.replace("Bearer ", "");

    if (!token) {
      throw new ApiError(401, "Unauthorized");
    }

    try {
      const decodedToken = jwt.verify(
        token,
        ACCESS_TOKEN_SECRET!,
      ) as UserAccessTokenPayload;

      const user = await User.findById(decodedToken?._id).select(
        "-password -refreshToken -createdAt -updatedAt -__v",
      );

      if (!user) {
        throw new ApiError(401, "Unauthorized");
      }

      req.user = user;

      next();
    } catch (error: any) {
      throw new ApiError(401, error?.message || "Invalid Access Token");
    }
  },
);

export { verifyJwt };
