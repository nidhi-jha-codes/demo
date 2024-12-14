import mongoose, { Schema } from "mongoose";

const profileSchema = new Schema(
  {
    user: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    avatar: {
      type: String,
      default: null,
    },
  },
  {
    timestamps: true,
  },
);

export const Profile = mongoose.model("Profile", profileSchema);
