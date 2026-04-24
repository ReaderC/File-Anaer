function isPlainObject(value) {
  return Object.prototype.toString.call(value) === "[object Object]";
}

function mergeWithDefaults(defaultValue, currentValue) {
  if (currentValue === undefined) {
    return cloneDefaultValue(defaultValue);
  }
  if (Array.isArray(defaultValue)) {
    return Array.isArray(currentValue) ? [...currentValue] : [...defaultValue];
  }
  if (isPlainObject(defaultValue)) {
    const result = {};
    const source = isPlainObject(currentValue) ? currentValue : {};
    const keys = new Set([...Object.keys(defaultValue), ...Object.keys(source)]);
    keys.forEach((key) => {
      result[key] = mergeWithDefaults(defaultValue[key], source[key]);
    });
    return result;
  }
  return currentValue ?? defaultValue;
}

function cloneDefaultValue(value) {
  if (Array.isArray(value)) {
    return [...value];
  }
  if (isPlainObject(value)) {
    const result = {};
    Object.keys(value).forEach((key) => {
      result[key] = cloneDefaultValue(value[key]);
    });
    return result;
  }
  return value;
}

export function createMemoryStateStore(defaultState) {
  let currentState = cloneDefaultValue(defaultState);

  return {
    read() {
      return mergeWithDefaults(defaultState, currentState);
    },
    write(nextState) {
      currentState = mergeWithDefaults(defaultState, nextState);
    },
    reset() {
      currentState = cloneDefaultValue(defaultState);
    }
  };
}
