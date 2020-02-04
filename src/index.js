import React, { useState } from "react";
import PropTypes from "prop-types";
import { Map } from "immutable";
import { useMutator } from "react-use-mutator";
import uuidv4 from "uuid/v4";
import { lookup } from "react-native-mime-types";
import storage from "@react-native-firebase/storage";

export const TaskStatus = {
  CREATED: 0,
  UPLOADING: 1,
  FINISHED: 2,
  ERROR: 3
};

const UploadProviderError = Object.freeze(
  new Error(
    "It looks like you haven't declared a FirebaseUploadProvider at the root of your application."
  )
);

const defaultMimeTypes = Object.freeze([]);

const defaultContext = Object.freeze({
  useUploads: () => {
    throw UploadProviderError;
  },
  requestUpload: () => Promise.reject(UploadProviderError)
});

const FirebaseUploadContext = React.createContext(defaultContext);

export const useFirebaseUploads = () => React.useContext(FirebaseUploadContext);

const createTask = (uri, mimeType) =>
  Object.freeze({
    status: TaskStatus.CREATED,
    uri,
    mimeType,
    bytesTransferred: 0,
    totalBytes: undefined
  });

const updateTaskStatus = (task, status) =>
  Object.freeze({
    ...task,
    status
  });

const updateTaskProgress = (task, bytesTransferred, totalBytes) =>
  Object.freeze({
    ...task,
    bytesTransferred,
    totalBytes
  });

const publishTaskUpdates = (uploadTask, mutate, uploadId) => {
  const unsubscribe = uploadTask.on(
    storage.TaskEvent.STATE_CHANGED,
    snapshot => {
      const { state, bytesTransferred, totalBytes } = snapshot;
      mutate(state =>
        state.set(
          uploadId,
          updateTaskProgress(state.get(uploadId), bytesTransferred, totalBytes)
        )
      );
      if (state === storage.TaskState.SUCCESS) {
        unsubscribe();
      }
    },
    err => unsubscribe()
  );
};

const performUpload = (uploadId, mutate, createRef, taskState) =>
  Promise.resolve()
    .then(() => {
      const { uri, mimeType: contentType } = taskState;
      const ref = createRef(uploadId, taskState);
      const uploadTask = ref.putFile(uri, { contentType });
      // XXX: Asynchronously update state.
      publishTaskUpdates(uploadTask, mutate, uploadId);
      return uploadTask.then(() => ref);
    })
    .then(ref => {
      mutate(state =>
        state.set(
          uploadId,
          updateTaskStatus(state.get(uploadId), TaskStatus.FINISHED)
        )
      );
      return Promise.resolve(ref);
    })
    .catch(e => {
      mutate(state =>
        state.set(
          uploadId,
          updateTaskStatus(state.get(uploadId), TaskStatus.ERROR)
        )
      );
      return Promise.reject(e);
    });

const shouldUpload = (uploadId, mutate, createRef) =>
  Promise.resolve()
    .then(() => {
      const currentState = mutate();
      const taskState = currentState.get(uploadId);
      if (!!taskState && typeof taskState === "object") {
        const { status } = taskState;
        if (status === TaskStatus.CREATED || status === TaskStatus.ERROR) {
          const nextTaskState = updateTaskStatus(
            taskState,
            TaskStatus.UPLOADING
          );
          mutate(state => state.set(uploadId, mutate, nextTaskState));
          return Promise.resolve(nextTaskState);
        }
        return Promise.reject(
          new Error("This task is not in the correct state to be uploaded.")
        );
      }
      return Promise.reject(
        new Error(`Attempted to upload an unrecogized uploadId, "${uploadId}".`)
      );
    })
    .then(taskState => performUpload(uploadId, mutate, createRef, taskState));

const requestUploadThunk = (mutate, supportedMimeTypes, createRef) => (
  uri,
  customCreateRef = null
) => {
  const mimeType = lookup(uri);
  // TODO: Need to validate the uri and mimeType
  if (typeof uri !== "string" || uri.length === 0) {
    throw new Error(`Expected valid uri, encountered ${uri}.`);
  } else if (typeof mimeType !== "string" || mimeType.length === 0) {
    throw new Error(`Expected valid mimeType, encountered ${mimeType}.`);
  } else if (supportedMimeTypes.indexOf(mimeType) < 0) {
    throw new Error(
      `Mime Type ${mimeType} is not supported. You can add this to the supportedMimeTypes prop of your provider if you wish to support kind of content.`
    );
  }
  const uploadId = uuidv4();
  mutate(state => state.set(uploadId, createTask(uri, mimeType)));
  return [
    uploadId,
    () => shouldUpload(uploadId, mutate, customCreateRef || createRef)
  ];
};

const FirebaseUploadProvider = ({
  supportedMimeTypes,
  createRef,
  ...extraProps
}) => {
  const [useUploads, mutate] = useMutator(() => Map());
  const [requestUpload] = useState(() =>
    requestUploadThunk(mutate, supportedMimeTypes, createRef)
  );
  return (
    <FirebaseUploadContext.Provider
      value={{
        requestUpload,
        useUploads
      }}
    >
      <React.Fragment {...extraProps} />
    </FirebaseUploadContext.Provider>
  );
};

FirebaseUploadProvider.propTypes = {
  supportedMimeTypes: PropTypes.arrayOf(PropTypes.string),
  createRef: PropTypes.func
};

FirebaseUploadProvider.defaultProps = {
  supportedMimeTypes: defaultMimeTypes,
  createRef: (taskId, { mimeType }) =>
    storage()
      .ref(mimeType.substring(0, mimeType.indexOf("/")))
      .child(taskId)
};

export default FirebaseUploadProvider;
