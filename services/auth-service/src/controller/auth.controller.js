import User from "../../../shared/models/user.model.js"
import jwt from "jsonwebtoken"
import asyncHandler from "../middlewares/tryCatch.js"
import axios from "axios"
import { oauth2client } from "../../../shared/config/googleConfig.js"

export const loginUser = asyncHandler(async (req, res) => {
  const { code } = req.body

  if (!code) {
    return res.status(400).json({
      message: "Authorization code is required"
    })
  }

  // exchange authorization code for google tokens
  const googleRes = await oauth2client.getToken(code)
  const tokens = googleRes.tokens
  oauth2client.setCredentials(tokens)

  // fetch user info from google
  const userRes = await axios.get(
    `https://www.googleapis.com/oauth2/v1/userinfo?alt=json&access_token=${googleRes.tokens.access_token}`
  )

  const { email, name, picture } = userRes.data

  let user = await User.findOne({ email })

  if (!user) {
    user = await User.create({
      name,
      email,
      image: picture
    })
  }

  const accessToken = jwt.sign({ user }, process.env.JWT_SEC, {
    expiresIn: "15m"
  })

  const refreshToken = jwt.sign({ user }, process.env.JWT_REFRESH_SEC || process.env.JWT_SEC, {
    expiresIn: "7d"
  })

  user.refreshToken = refreshToken
  await user.save()

  res.status(200).json({
    message: "logged in successfully",
    accessToken,
    refreshToken,
    user
  })
})

export const myProfile = asyncHandler(async (req, res) => {
  const user = req.user
  res.json(user)
})

export const refreshAccessToken = asyncHandler(async (req, res) => {
  const { refreshToken } = req.body

  if (!refreshToken) {
    return res.status(401).json({ message: "Refresh token is required" })
  }

  try {
    const decodedValue = jwt.verify(refreshToken, process.env.JWT_REFRESH_SEC || process.env.JWT_SEC)

    if (!decodedValue || !decodedValue.user) {
      return res.status(401).json({ message: "Invalid refresh token" })
    }

    const dbUser = await User.findById(decodedValue.user._id)
    if (!dbUser || dbUser.refreshToken !== refreshToken) {
      return res.status(401).json({ message: "Refresh token is invalid or has been revoked" })
    }

    const newAccessToken = jwt.sign({ user: dbUser }, process.env.JWT_SEC, {
      expiresIn: "15m"
    })

    res.status(200).json({
      message: "Access token refreshed successfully",
      accessToken: newAccessToken
    })
  } catch (error) {
    return res.status(401).json({ message: "Refresh token expired or invalid" })
  }
})

export const logoutUser = asyncHandler(async (req, res) => {
  const { refreshToken } = req.body
  //cokkie system will be implemented later
  if (refreshToken) {
    try {
      const decodedValue = jwt.verify(refreshToken, process.env.JWT_REFRESH_SEC || process.env.JWT_SEC)
      if (decodedValue && decodedValue.user) {
        await User.findByIdAndUpdate(decodedValue.user._id, { $unset: { refreshToken: "" } })
      }
    } catch (error) {
      console.log(error)
    }
  }

  res.status(200).json({
    message: "Logged out successfully"
  })
})