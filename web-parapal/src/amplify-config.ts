// src/amplify-config.ts
import type { ResourcesConfig } from 'aws-amplify';

const amplifyConfig: ResourcesConfig = {
  Auth: {
    Cognito: {
      // 👇 fill these from your Cognito user pool
      userPoolId: 'us-east-1_5qISjoBxu',        // <-- your User Pool ID
      userPoolClientId: '66eeihdaoa8lhp4175118kkq2p',  // <-- your App client ID

      // Optional but recommended settings
      loginWith: {
        email: true,        // match your pool sign-in method
        // username: true,  // enable if your pool allows username login
      },
      signUpVerificationMethod: 'code', // typical email-code signup
      userAttributes: {
        email: { required: true },
      },
    },
  },
};

export default amplifyConfig;
