import User from "../../../shared/models/user.model.js"
import jwt from "jsonwebtoken"
import bcrypt from "bcryptjs"
import asyncHandler from "../middlewares/tryCatch.js"
import axios from "axios"
import { getOAuth2Client } from "../../../shared/config/googleConfig.js"

const accessTokenSecret = () => {
  return process.env.JWT_SEC || "fallback_jwt_secret_streamwise_key_123"
}

const refreshTokenSecret = () => process.env.JWT_REFRESH_SEC || accessTokenSecret()

const tokenPayload = (user, type) => ({
  userId: user._id.toString(),
  email: user.email,
  type,
})

const issueTokens = (user) => ({
  accessToken: jwt.sign(tokenPayload(user, "access"), accessTokenSecret(), {
    expiresIn: "2h",
  }),
  refreshToken: jwt.sign(tokenPayload(user, "refresh"), refreshTokenSecret(), {
    expiresIn: "30d",
  }),
})

const findUserForRefreshToken = async (refreshToken) => {
  const decoded = jwt.verify(refreshToken, refreshTokenSecret())

  if (decoded.type !== "refresh" || !decoded.userId) {
    return null
  }

  const user = await User.findById(decoded.userId).select("+refreshTokenHash")

  if (!user?.refreshTokenHash) {
    return null
  }

  const tokenMatches = await bcrypt.compare(refreshToken, user.refreshTokenHash)
  return tokenMatches ? user : null
}

export const loginUser = asyncHandler(async (req, res) => {
  const { code } = req.body

  if (!code) {
    return res.status(400).json({
      message: "Authorization code is required"
    })
  }

  const client = getOAuth2Client()
  let tokens
  try {
    const googleRes = await client.getToken(code)
    tokens = googleRes.tokens
  } catch (err) {
    console.error("Google Token Exchange Error:", err?.response?.data || err.message)
    return res.status(400).json({
      message: "Google OAuth exchange failed: " + (err?.response?.data?.error_description || err?.response?.data?.error || err.message)
    })
  }

  if (!tokens?.access_token) {
    return res.status(401).json({ message: "Google authentication failed: missing access token" })
  }

  // fetch user info from google
  const userRes = await axios.get(
    "https://www.googleapis.com/oauth2/v1/userinfo",
    {
      params: {
        alt: "json",
        access_token: tokens.access_token,
      },
    }
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

  const { accessToken, refreshToken } = issueTokens(user)

  user.refreshTokenHash = await bcrypt.hash(refreshToken, 12)
  await user.save()

  res.status(200).json({
    message: "logged in successfully",
    accessToken,
    refreshToken,
    user
  })
})

export const myProfile = asyncHandler(async (req, res) => {
  const user = await User.findById(req.auth.userId)

  if (!user) {
    return res.status(404).json({ message: "User not found" })
  }

  res.status(200).json({ user })
})

export const refreshAccessToken = asyncHandler(async (req, res) => {
  const { refreshToken } = req.body

  if (!refreshToken) {
    return res.status(401).json({ message: "Refresh token is required" })
  }

  try {
    const dbUser = await findUserForRefreshToken(refreshToken)

    if (!dbUser) {
      return res.status(401).json({ message: "Refresh token is invalid or has been revoked" })
    }

    const { accessToken, refreshToken: nextRefreshToken } = issueTokens(dbUser)
    dbUser.refreshTokenHash = await bcrypt.hash(nextRefreshToken, 12)
    await dbUser.save()

    res.status(200).json({
      message: "Tokens refreshed successfully",
      accessToken,
      refreshToken: nextRefreshToken,
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
      const user = await findUserForRefreshToken(refreshToken)
      if (user) {
        user.refreshTokenHash = null
        await user.save()
      }
    } catch {
      // Logout is idempotent: an expired or invalid token is already unusable.
    }
  }

  res.status(200).json({
    message: "Logged out successfully"
  })
})
