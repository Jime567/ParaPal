// src/auth.ts
import {
  signUp,
  confirmSignUp,
  signIn,
  signOut,
  getCurrentUser,
} from 'aws-amplify/auth';

export async function registerUser(email: string, password: string) {
  return await signUp({
    username: email,
    password,
    options: {
      userAttributes: {
        email,
      },
    },
  });
}

export async function confirmUser(email: string, code: string) {
  return await confirmSignUp({
    username: email,
    confirmationCode: code,
  });
}

export async function loginUser(email: string, password: string) {
  return await signIn({
    username: email,
    password,
  });
}

export async function logoutUser() {
  await signOut();
}

export async function getCurrentCognitoUser() {
  try {
    const user = await getCurrentUser();
    const email =
      user.signInDetails?.loginId || // usually the email they logged in with
      user.username;                 // fallback if loginId is missing

    return {
      ...user,
      email,
    };
  } catch {
    return null;
  }
}