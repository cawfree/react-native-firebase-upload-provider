# react-native-firebase-upload-provider
📸Easily and quickly upload rich media to Firebase Storage. This library safely handles all of the lower level firebase storage transactions, whilst providing a sensible interface to synchronize your frontend with the transaction state.

## Getting Started 

Using [`npm`]():

```bash
npm install --save react-native-firebase-upload-provider
```

Using [`yarn`]():

```bash
yarn add react-native-firebase-upload-provider
```

## Requirements

  - Make sure you've added the `google-services.json` and `GoogleService-Info.plist` to your `*/android/app/` and `*/ios/` directories respectively.
    - If this sounds new to you, it would be worth checking out the [Getting Started](https://rnfirebase.io/docs/v5.x.x/getting-started) tutorials on [react-native-firebase](https://rnfirebase.io/).
  - Once your project is hooked up, head over to your project in [Firebase](https://firebase.google.com/) and make sure you've [enabled Firebase Storage](https://firebase.google.com/docs/storage/web/start).
  - Finally, you'll need to make sure your application has the appropriate permissions to write to the storage bucket.
    - By default, they do not permit anything to be written. For testing purposes, you can go ahead and turn `false` into `true` to permit anyone to read and write.
    - **Note**: This is not a safe configuration to use within a production environment, and you **will** regret it.

```
rules_version = '2';
service firebase.storage {
  match /b/{bucket}/o {
    match /{allPaths=**} {
      allow read, write: if false;
    }
  }
}

```

## Usage

1. First, wrap your application with the `FirebaseUploadProvider`:

```javascript
import React from 'react';
import { Text } from 'react-native-firebase';
import FirebaseUploadProvider from 'react-native-firebase-upload-provider';

export default () => (
  <FirebaseUploadProvider
    supportedMimeTypes={[
      "image/png",
      "image/jpeg"
    ]}
  >
    <Text
      children="Best app ever."
    />
  </FirebaseUploadProvider>
);
```

This provides all of the data dependencies required to perform a file upload from basically anywhere in your application. In particular, notice that we're required to specify which [Mime Types](https://www.npmjs.com/package/mime-types) are permitted to be uploaded to your [Storage Bucket](https://cloud.google.com/storage/docs/creating-buckets). By default, no mime types are specified as a safeguard to prevent any users from uploading potentially undesirable content.

2. Next, there are the [hooks](https://reactjs.org/docs/hooks-intro.html). There are two you'll be interested in:

```javascript
import { useFirebaseUploads } from 'react-native-firebase-upload-provider';

const UploadButton = ({ ...extraProps }) => {
  const { useUploads, requestUpload } = useFirebaseUploads();
  return ...;
}
```

  2.1 `requestUpload(uri)`
  This hook is used to upload an asset from the local filesystem up to firebase. It is a **synchronous** call, which when invoked returns an array with the following shape:

```javascript
const [uploadId, beginUpload] = requestUpload('file://path/to/some/asset.jpeg');
```
  
  The `uploadId` is an internal [`uuidv4`](https://www.npmjs.com/package/uuid) which is used to uniquely track the transaction of the specified file, whilst `beginUpload` is a function which when invoked attempts to start the transaction, or restart the transaction if it had previously failed.

  Upon completion, `beginUpload` resolves with the raw result of the transaction.

  2.2 `useUploads()`
  This hook allows you to interrogate the state of the ongoing transactions, and have your registered component re-rensder when any of the transactions have been updated. This is how we can determine things like the state of the task, the number of `bytesTransferred` and the `totalNumberOfBytes`, etc.

```javascript
const { useUploads } = useFirebaseUploads();
const uploads = useUploads();
return (
  <Text
    children={JSON.stringify(uploads)}
  />
);
```

  This allows you to easily synchronize the interface presented to your user with the ongoing transaction.

## License
[MIT](https://opensource.org/licenses/MIT)
  
