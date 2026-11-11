// @flow
import {createContext} from 'react';

// Types the type select in the header of the surrounding block may switch to, null without restriction.
export default createContext<?Array<string>>(null);
