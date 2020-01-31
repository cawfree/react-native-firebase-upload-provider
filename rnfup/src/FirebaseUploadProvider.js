import React, { useState } from 'react';
import PropTypes from 'prop-types';
import { Map } from 'immutable';
import { useMutator } from 'react-use-mutator';
import uuidv4 from 'uuid/v4';

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

const createTask = uri => Object.freeze({
  status: TaskStatus.CREATED,
  uri,
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
          mutate(
            (state) => state
              .set(uploadId, updateTaskStatus(taskState, TaskStatus.UPLOADING)),
          );
          return Promise
            .resolve(taskState);
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
      console.warn('got here',taskState);
    },
  );

const requestUploadThunk = mutate => uri => {
  const uploadId = uuidv4();
  mutate(
    state => state.set(
      uploadId,
      createTask(uri),
    ),
  );
  return [uploadId, () => shouldUpload(uploadId, mutate)];
};

const FirebaseUploadProvider = (props) => {
  const [useUploads, mutate] = useMutator(
    () => Map(),
  );
  const [requestUpload] = useState(
    () => requestUploadThunk(mutate),
  );
  return (
    <FirebaseUploadContext.Provider
      value={{
        requestUpload,
        useUploads,
      }}
    >
      <React.Fragment
        {...props}
      />
    </FirebaseUploadContext.Provider>
  );
};

FirebaseUploadProvider.propTypes = {
};

FirebaseUploadProvider.defaultProps = {
};

export default FirebaseUploadProvider;
