import mongoose, { Model, Schema } from "mongoose";
import bcrypt from "bcrypt";
import jwt, { JwtPayload } from "jsonwebtoken";

import {
  ACCESS_TOKEN_EXPIRY,
  ACCESS_TOKEN_SECRET,
  REFRESH_TOKEN_EXPIRY,
  REFRESH_TOKEN_SECRET,
} from "../constants";

export interface UserRefreshTokenPayload extends JwtPayload {
  _id: string;
}

export interface UserAccessTokenPayload extends JwtPayload {
  _id: string;
  email: string;
  username: string;
}

interface IUser extends Document {
  fullName: string;
  email: string;
  username: string;
  password: string;
  refreshToken: string;
  checkPassword: (password: string) => Promise<boolean>;
  generateAccessToken: () => string;
  generateRefreshToken: () => string;
}

const userSchema = new Schema(
  {
    fullName: {
      type: String,
      required: [true, "Full Name is Required"],
      trim: true,
      index: true,
    },
    username: {
      type: String,
      required: [true, "Username is Required"],
      unique: true,
      lowercase: true,
      trim: true,
      index: true,
    },
    email: {
      type: String,
      required: [true, "Email is Required"],
      unique: true,
      lowercase: true,
      trim: true,
      index: true,
    },
    password: {
      type: String,
      required: [true, "Password is Required"],
    },
    refreshToken: {
      type: String,
    },
  },
  {
    timestamps: true,
  },
);

userSchema.pre("save", async function (next) {
  if (!this.isModified("password")) return next();

  this.password = await bcrypt.hash(this.password, 10);

  next();
});

userSchema.methods.checkPassword = async function (password: string) {
  return await bcrypt.compare(password, this.password);
};

userSchema.methods.generateAccessToken = function () {
  const token = jwt.sign(
    {
      id: this._id,
      email: this.email,
      username: this.username,
    },
    ACCESS_TOKEN_SECRET!,
    { expiresIn: ACCESS_TOKEN_EXPIRY },
  );

  return token;
};

userSchema.methods.generateRefreshToken = function () {
  const token = jwt.sign(
    {
      id: this._id,
    },
    REFRESH_TOKEN_SECRET!,
    { expiresIn: REFRESH_TOKEN_EXPIRY },
  );

  return token;
};

export const User: Model<IUser> = mongoose.model<IUser>("User", userSchema);
