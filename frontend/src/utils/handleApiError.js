
export function handleApiError(error, setErrors, toastFn) {
  if (!error) return;

  // plain string
  if (typeof error === "string") {
    toastFn(error);
    return;
  }

  if (typeof error === "object") {
    
    if (error.message) {
      toastFn(error.message);
      return;
    }

    const { non_field_errors, detail, ...fieldErrors } = error;

    // field-level errors → inline
    if (Object.keys(fieldErrors).length > 0) {
      setErrors(fieldErrors);
    }

    // global errors → toast
    if (non_field_errors?.length) {
      toastFn(non_field_errors[0]);
    } else if (detail) {
      toastFn(typeof detail === "string" ? detail : detail[0]);
    }
  }
}