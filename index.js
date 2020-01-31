import React, { useState } from 'react';
import PropTypes from 'prop-types';
import { Map } from 'immutable';
import { useMutator } from 'react-use-mutator';
import uuidv4 from 'uuid/v4';
import { lookup } from 'react-native-mime-types';

export const TaskStatus = {
  CREATED: 0,
  UPLOADING: 1,
};

const UploadProviderError = Object
  .freeze(
    new Error(
      "It looks like you haven\'t declared a FirebaseUploadProvider at the root of your application.",
    ),
  );

const defaultMimeTypes = Object.freeze([]);

const defaultContext = Object
  .freeze(
    {
      useUploads: () => { throw UploadProviderError; },
      requestUpload: () => Promise.reject(UploadProviderError),
    },
  );

const FirebaseUploadContext = React.createContext(
  defaultContext,
);

export const useFirebaseUploads = () => React.useContext(FirebaseUploadContext);

const createTask = (uri, mimeType) => Object.freeze({
  status: TaskStatus.CREATED,
  uri,
  mimeType,
});

const updateTaskStatus = (task, status) => Object.freeze({
  ...task,
  status,
});

const shouldUpload = (uploadId, mutate) => Promise
  .resolve()
  .then(
    () => {
      const currentState = mutate();
      const taskState = currentState.get(uploadId);
      if (!!taskState && typeof taskState === 'object') {
        const { status } = taskState;
        if (status === TaskStatus.CREATED) {
          const nextTaskState = updateTaskStatus(taskState, TaskStatus.UPLOADING);
          mutate(
            (state) => state
              .set(uploadId, nextTaskState),
          );
          return Promise
            .resolve(nextTaskState);
        }
        return Promise.reject(
          new Error('This task is not in the correct state to be uploaded.'),
        );
      }
      return Promise
        .reject(
          new Error(`Attempted to upload an unrecogized uploadId, "${uploadId}".`),
        );
    },
  )
  .then(
    (taskState) => {
      return Promise.reject('do not know how to upload');
    },
  );

const requestUploadThunk = (mutate, supportedMimeTypes) => (uri) => {
  const mimeType = lookup(uri);
  // TODO: Need to validate the uri and mimeType
  if (typeof uri !== 'string' || uri.length === 0) {
    throw new Error(`Expected valid uri, encountered ${uri}.`);
  } else if (typeof mimeType !== 'string' || mimeType.length === 0) {
    throw new Error(`Expected valid mimeType, encountered ${mimeType}.`);
  } else if (supportedMimeTypes.indexOf(mimeType) < 0) {
    throw new Error(`Mime Type ${mimeType} is not supported. You can add this to the supportedMimeTypes prop of your provider if you wish to support kind of content.`);
  }
  const uploadId = uuidv4();
  mutate(
    state => state.set(
      uploadId,
      createTask(uri, mimeType),
    ),
  );
  return [uploadId, () => shouldUpload(uploadId, mutate)];
};

const FirebaseUploadProvider = ({ supportedMimeTypes, ...extraProps }) => {
  const [useUploads, mutate] = useMutator(
    () => Map(),
  );
  const [requestUpload] = useState(
    () => requestUploadThunk(mutate, supportedMimeTypes),
  );
  return (
    <FirebaseUploadContext.Provider
      value={{
        requestUpload,
        useUploads,
      }}
    >
      <React.Fragment
        {...extraProps}
      />
    </FirebaseUploadContext.Provider>
  );
};

FirebaseUploadProvider.propTypes = {
  supportedMimeTypes: PropTypes.arrayOf(PropTypes.string),
};

FirebaseUploadProvider.defaultProps = {
  supportedMimeTypes: defaultMimeTypes,
};

export default FirebaseUploadProvider;
