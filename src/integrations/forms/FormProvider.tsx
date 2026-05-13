// @ts-nocheck
import React, {
    createContext,
    useContext,
    useState,
    useRef,
    useCallback,
} from 'react';
import { cn } from "@/lib/utils"
import { useForm as useReactHookForm, FormProvider as ReactHookFormProvider } from 'react-hook-form';



/** -------- Types -------- */
export interface FormData {
    [fieldName: string]: string | number | boolean | File | undefined;
}

export interface ValidationRule {
    required?: boolean;
    minLength?: number;
    maxLength?: number;
    min?: number;
    max?: number;
    pattern?: 'email' | 'phone' | 'url' | string; // regex pattern or predefined type
    custom?: (value: any) => string | null; // custom validation function
}

export interface ValidationRules {
    [fieldName: string]: ValidationRule;
}

/** -------- Form Schema Types (for registered forms) -------- */
export interface FormFieldValidation {
    minLength?: number;
    maxLength?: number;
    min?: number;
    max?: number;
    pattern?: string;
}

export interface FormFieldSchema {
    field_key: string;
    label: string;
    field_type: 'text' | 'email' | 'textarea' | 'phone' | 'number' | 'url' | 'date' | 'select' | 'checkbox' | 'radio';
    placeholder?: string;
    required?: boolean;
    options?: string[];  // For select/radio fields
    validation?: FormFieldValidation;
}

export interface FormSchema {
    form_key: string;
    form_label: string;
    fields: FormFieldSchema[];
    // Note: submit_button_text, success_message, error_message are NOT stored in schema
    // These are generated contextually by AI during page generation and passed as props
}

// Declare global window type for form schemas
declare global {
    interface Window {
        __WVC_FORMS__?: { [formKey: string]: FormSchema };
    }
}

interface WvcFormContextType {
    // Form identification
    formId: string;
    sectionName: string;

    // State
    isSubmitting: boolean;
    isSubmitted: boolean;
    submitError: string | null;
    successMessage: string;

    // Schema (if available)
    formSchema?: FormSchema;

    // Actions
    handleSubmit: (e?: React.BaseSyntheticEvent) => Promise<void>;
    resetForm: () => void;

    // Form methods (expose react-hook-form methods)
    control: any;
    formState: any;
    register: any;
    setValue: any;
    getValues: any;
    watch: any;
}

type FormProviderProps = {
    children: React.ReactNode;
    formId: string;
    sectionName: string;

    // Schema-based configuration (optional)
    formKey?: string;           // Load form schema from window.__WVC_FORMS__[formKey]
    formSchema?: FormSchema;    // Direct schema injection

    // Manual configuration (used if no schema, or to override schema)
    validationRules?: ValidationRules;
    submitText?: string;
    successMessage?: string;
    errorMessage?: string;
    defaultValues?: any;
    formVersion?: string;
} & React.HTMLAttributes<HTMLDivElement>;

// Create context for WVC-specific form functionality
const WvcFormContext = createContext<WvcFormContextType | null>(null);

// Custom hook to use WVC form context
export const useWvcForm = () => {
    const context = useContext(WvcFormContext);
    if (!context) {
        throw new Error('useWvcForm must be used within a FormProvider');
    }
    return context;
};

// Note: Do NOT re-export useForm to prevent confusion with useWvcForm
// Always use useWvcForm() inside FormProvider components

// Predefined validation patterns
const VALIDATION_PATTERNS = {
    email: /^[^\s@]+@[^\s@]+\.[^\s@]+$/,
    phone: /^[\+]?[1-9][\d]{0,15}$/,
    url: /^https?:\/\/.+/,
};

// Helper function to convert validation rules to react-hook-form format
const convertValidationRules = (rules: ValidationRules) => {
    const rhfRules: any = {};

    Object.entries(rules).forEach(([fieldName, rule]) => {
        rhfRules[fieldName] = {};

        if (rule.required) {
            rhfRules[fieldName].required = `${fieldName} is required`;
        }

        if (rule.minLength) {
            rhfRules[fieldName].minLength = {
                value: rule.minLength,
                message: `${fieldName} must be at least ${rule.minLength} characters`
            };
        }

        if (rule.maxLength) {
            rhfRules[fieldName].maxLength = {
                value: rule.maxLength,
                message: `${fieldName} must be no more than ${rule.maxLength} characters`
            };
        }

        if (rule.pattern) {
            let pattern: RegExp;
            if (typeof rule.pattern === 'string' && VALIDATION_PATTERNS[rule.pattern as keyof typeof VALIDATION_PATTERNS]) {
                pattern = VALIDATION_PATTERNS[rule.pattern as keyof typeof VALIDATION_PATTERNS];
            } else if (typeof rule.pattern === 'string') {
                pattern = new RegExp(rule.pattern);
            } else {
                pattern = rule.pattern;
            }

            rhfRules[fieldName].pattern = {
                value: pattern,
                message: `Please enter a valid ${typeof rule.pattern === 'string' ? rule.pattern : 'format'}`
            };
        }

        if (rule.custom) {
            rhfRules[fieldName].validate = rule.custom;
        }
    });

    return rhfRules;
};

// Helper function to convert schema field validation to ValidationRules format
const schemaToValidationRules = (schema: FormSchema): ValidationRules => {
    const rules: ValidationRules = {};

    for (const field of schema.fields) {
        const fieldRule: ValidationRule = {};

        if (field.required) {
            fieldRule.required = true;
        }

        // Map field_type to pattern
        if (field.field_type === 'email') {
            fieldRule.pattern = 'email';
        } else if (field.field_type === 'phone') {
            fieldRule.pattern = 'phone';
        } else if (field.field_type === 'url') {
            fieldRule.pattern = 'url';
        }

        // Apply explicit validation rules from schema
        if (field.validation) {
            if (field.validation.minLength) fieldRule.minLength = field.validation.minLength;
            if (field.validation.maxLength) fieldRule.maxLength = field.validation.maxLength;
            if (field.validation.min) fieldRule.min = field.validation.min;
            if (field.validation.max) fieldRule.max = field.validation.max;
            if (field.validation.pattern) fieldRule.pattern = field.validation.pattern;
        }

        if (Object.keys(fieldRule).length > 0) {
            rules[field.field_key] = fieldRule;
        }
    }

    return rules;
};

// Helper function to derive default values from schema
const schemaToDefaultValues = (schema: FormSchema): { [key: string]: any } => {
    const defaults: { [key: string]: any } = {};

    for (const field of schema.fields) {
        // Set appropriate default based on field type
        switch (field.field_type) {
            case 'checkbox':
                defaults[field.field_key] = false;
                break;
            case 'number':
                defaults[field.field_key] = '';
                break;
            default:
                defaults[field.field_key] = '';
        }
    }

    return defaults;
};

// FormProvider component that wraps react-hook-form
const FormProvider: React.FC<FormProviderProps> = ({
    children,
    formId,
    sectionName,
    formKey,
    formSchema: propFormSchema,
    validationRules: propValidationRules = {},
    submitText: propSubmitText,
    successMessage: propSuccessMessage,
    errorMessage: propErrorMessage,
    defaultValues: propDefaultValues = {},
    formVersion = "1.0.0",
    ...divProps
}) => {
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [isSubmitted, setIsSubmitted] = useState(false);
    const [submitError, setSubmitError] = useState<string | null>(null);
    const submissionAttemptRef = useRef(0);

    // Resolve form schema from formKey or direct prop
    const resolvedSchema = React.useMemo<FormSchema | undefined>(() => {
        // Direct schema takes precedence
        if (propFormSchema) return propFormSchema;

        // Try to load from window.__WVC_FORMS__
        if (formKey && typeof window !== 'undefined' && window.__WVC_FORMS__) {
            return window.__WVC_FORMS__[formKey];
        }

        return undefined;
    }, [formKey, propFormSchema]);

    // Derive configuration from schema with prop overrides
    const {
        validationRules,
        submitText,
        successMessage,
        errorMessage,
        defaultValues
    } = React.useMemo(() => {
        // Start with schema-derived values if available
        const schemaRules = resolvedSchema ? schemaToValidationRules(resolvedSchema) : {};
        const schemaDefaults = resolvedSchema ? schemaToDefaultValues(resolvedSchema) : {};

        return {
            // Merge: prop validation rules override schema rules
            validationRules: { ...schemaRules, ...propValidationRules },
            // Props or defaults (no schema fallback for UI messages - they're generated by AI per page)
            submitText: propSubmitText ?? "Submit",
            successMessage: propSuccessMessage ?? "Form submitted successfully!",
            errorMessage: propErrorMessage ?? "Failed to submit form. Please try again.",
            // Merge: prop default values override schema defaults
            defaultValues: { ...schemaDefaults, ...propDefaultValues }
        };
    }, [resolvedSchema, propValidationRules, propSubmitText, propSuccessMessage, propErrorMessage, propDefaultValues]);

    // Initialize react-hook-form with resolved default values
    const methods = useReactHookForm({
        defaultValues: defaultValues || {},
        mode: 'onBlur', // Validate on blur for better UX
    });

    const { handleSubmit: rhfHandleSubmit, reset, formState } = methods;

    // Submit form
    const handleSubmit = useCallback(async (data: any) => {
        if (isSubmitting) return;

        setIsSubmitting(true);
        setSubmitError(null);
        submissionAttemptRef.current += 1;

        try {
            // Prepare submission data
            const submissionData = {
                // Required fields
                sectionName,
                formId,
                formKey: formKey || resolvedSchema?.form_key,  // Include registered form key if available
                formData: data,

                // Auto-generated fields
                timestamp: Date.now(),
                sessionId: wvcClient.getSessionId?.() || 'unknown',
                pageUrl: window.location.href,
                userAgent: navigator.userAgent,

                // Optional metadata
                validationErrors: formState.errors || null,
                submissionAttempt: submissionAttemptRef.current,
                formVersion,

                // Additional metadata can be added here
                validationRules,
            };

            // Call wvcClient.formSubmission
            const submissionResponse = await wvcClient.formSubmission(submissionData);



            // Success
            setIsSubmitted(true);
            setSubmitError(null);

        } catch (error) {
            console.error('Form submission error:', error);
            setSubmitError(errorMessage);
        } finally {
            setIsSubmitting(false);
        }
    }, [
        isSubmitting,
        sectionName,
        formId,
        formState.errors,
        errorMessage,
    ]);

    // Reset form
    const resetForm = useCallback(() => {
        reset();
        setIsSubmitted(false);
        setSubmitError(null);
        submissionAttemptRef.current = 0;
    }, [reset]);

    const wvcFormValue: WvcFormContextType = {
        formId,
        sectionName,
        isSubmitting,
        isSubmitted,
        submitError,
        successMessage,
        formSchema: resolvedSchema,
        handleSubmit: rhfHandleSubmit(handleSubmit),
        resetForm,
        // Expose react-hook-form methods
        control: methods.control,
        formState: methods.formState,
        register: methods.register,
        setValue: methods.setValue,
        getValues: methods.getValues,
        watch: methods.watch,
    };

    return (
        <ReactHookFormProvider {...methods}>
            <WvcFormContext.Provider value={wvcFormValue}>
                <div
                    {...divProps}
                    data-wvc-dynamic="FormProvider"
                    data-wvc-formId={formId}
                    data-wvc-formKey={formKey || resolvedSchema?.form_key || undefined}
                >
                    {children}
                </div>
            </WvcFormContext.Provider>
        </ReactHookFormProvider>
    );
}; export { FormProvider };