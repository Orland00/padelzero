export const PASSWORD_MIN_LENGTH = 12

export const validatePasswordPolicy = (password) => {
  if (typeof password !== 'string' || password.length < PASSWORD_MIN_LENGTH) {
    return {
      valid: false,
      code: 'password_min_length',
      message: `password_min_length:${PASSWORD_MIN_LENGTH}`,
    }
  }

  return { valid: true, code: null, message: null }
}
