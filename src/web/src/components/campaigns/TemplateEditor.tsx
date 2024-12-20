import React, { useCallback, useEffect, useState } from 'react';
import { Editor, useEditor } from '@tiptap/react'; // v2.1.0
import StarterKit from '@tiptap/starter-kit'; // v2.1.0
import BrazilianPortuguesePlugin from '@tiptap/extension-brazilian-portuguese'; // v2.1.0
import Input from '../common/Input';
import Button from '../common/Button';
import { MessageTemplate } from '../../types/campaigns';
import { validateForm } from '../../lib/validation';
import { COLORS } from '../../constants/ui';

interface TemplateEditorProps {
  template: MessageTemplate;
  onChange: (template: MessageTemplate) => void;
  onSave: () => void;
  onPreview: () => void;
  disabled?: boolean;
  healthcareCategory: string;
  lgpdCompliant: boolean;
  consentRequired: boolean;
}

interface ValidationErrors {
  name?: string;
  content?: string;
  variables?: string;
  medicalDisclaimer?: string;
}

interface LGPDComplianceState {
  hasPersonalData: boolean;
  hasConsentMessage: boolean;
  hasDisclaimer: boolean;
  isCompliant: boolean;
}

/**
 * Rich text editor component for creating and editing WhatsApp message templates
 * with healthcare-specific features and LGPD compliance.
 */
export const TemplateEditor: React.FC<TemplateEditorProps> = ({
  template,
  onChange,
  onSave,
  onPreview,
  disabled = false,
  healthcareCategory,
  lgpdCompliant,
  consentRequired,
}) => {
  // State management
  const [errors, setErrors] = useState<ValidationErrors>({});
  const [lgpdCompliance, setLgpdCompliance] = useState<LGPDComplianceState>({
    hasPersonalData: false,
    hasConsentMessage: false,
    hasDisclaimer: false,
    isCompliant: false,
  });

  // Initialize TipTap editor with healthcare extensions
  const editor = useEditor({
    extensions: [
      StarterKit,
      BrazilianPortuguesePlugin,
    ],
    content: template.content,
    editable: !disabled,
    onUpdate: ({ editor }) => {
      handleContentChange(editor.getText());
    },
  });

  /**
   * Validates template content for healthcare compliance and LGPD requirements
   */
  const validateTemplate = useCallback((content: string): ValidationErrors => {
    const errors: ValidationErrors = {};

    // Validate template name
    if (!template.name.trim()) {
      errors.name = 'Nome do template é obrigatório';
    }

    // Validate content length for WhatsApp
    if (content.length > 1024) {
      errors.content = 'Conteúdo excede o limite de 1024 caracteres';
    }

    // Validate medical disclaimer
    if (healthcareCategory && !template.medicalDisclaimer) {
      errors.medicalDisclaimer = 'Aviso médico é obrigatório para conteúdo de saúde';
    }

    // Validate LGPD compliance
    if (lgpdCompliant && !template.lgpdCompliant) {
      errors.content = 'Template não está em conformidade com a LGPD';
    }

    return errors;
  }, [template.name, template.medicalDisclaimer, healthcareCategory, lgpdCompliant]);

  /**
   * Handles insertion of variables with healthcare data protection
   */
  const insertVariable = useCallback((variableName: string) => {
    if (!editor) return;

    const variable = `{{${variableName}}}`;
    editor.commands.insertContent(variable);

    // Update template variables
    const updatedVariables = [...template.variables, variableName];
    onChange({
      ...template,
      variables: updatedVariables,
    });

    // Check for personal data variables
    const personalDataVars = ['nome', 'cpf', 'telefone', 'email'];
    if (personalDataVars.includes(variableName)) {
      setLgpdCompliance(prev => ({
        ...prev,
        hasPersonalData: true,
      }));
    }
  }, [editor, template, onChange]);

  /**
   * Handles content changes with validation
   */
  const handleContentChange = useCallback((content: string) => {
    const validationErrors = validateTemplate(content);
    setErrors(validationErrors);

    onChange({
      ...template,
      content,
    });

    // Update LGPD compliance state
    setLgpdCompliance(prev => ({
      ...prev,
      hasConsentMessage: content.includes('consentimento'),
      hasDisclaimer: !!template.medicalDisclaimer,
      isCompliant: !Object.keys(validationErrors).length,
    }));
  }, [template, onChange, validateTemplate]);

  /**
   * Renders the editor toolbar with healthcare-specific controls
   */
  const renderToolbar = () => (
    <div className="flex items-center space-x-2 p-2 border-b border-gray-200 dark:border-gray-700">
      <Button
        size="sm"
        variant="ghost"
        onClick={() => editor?.chain().focus().toggleBold().run()}
        disabled={disabled}
        ariaLabel="Negrito"
      >
        <span className="font-bold">B</span>
      </Button>
      
      <Button
        size="sm"
        variant="ghost"
        onClick={() => editor?.chain().focus().toggleItalic().run()}
        disabled={disabled}
        ariaLabel="Itálico"
      >
        <span className="italic">I</span>
      </Button>

      <div className="h-4 w-px bg-gray-300 dark:bg-gray-600" />

      <Button
        size="sm"
        variant="outline"
        onClick={() => insertVariable('nome')}
        disabled={disabled}
        ariaLabel="Inserir nome do paciente"
      >
        + Nome
      </Button>

      {healthcareCategory && (
        <Button
          size="sm"
          variant="outline"
          onClick={() => insertVariable('procedimento')}
          disabled={disabled}
          ariaLabel="Inserir procedimento"
        >
          + Procedimento
        </Button>
      )}
    </div>
  );

  return (
    <div className="space-y-4">
      {/* Template name input */}
      <Input
        id="template-name"
        name="name"
        label="Nome do Template"
        value={template.name}
        onChange={(value) => onChange({ ...template, name: value })}
        error={errors.name}
        disabled={disabled}
        required
      />

      {/* Rich text editor */}
      <div className="border rounded-md dark:border-gray-700">
        {renderToolbar()}
        <div className="p-4">
          <EditorContent editor={editor} />
        </div>
      </div>

      {/* Medical disclaimer for healthcare content */}
      {healthcareCategory && (
        <Input
          id="medical-disclaimer"
          name="medicalDisclaimer"
          label="Aviso Médico"
          value={template.medicalDisclaimer}
          onChange={(value) => onChange({ ...template, medicalDisclaimer: value })}
          error={errors.medicalDisclaimer}
          disabled={disabled}
          required
        />
      )}

      {/* LGPD compliance indicators */}
      {lgpdCompliant && (
        <div className="p-4 bg-blue-50 dark:bg-blue-900 rounded-md">
          <h4 className="font-medium text-blue-700 dark:text-blue-200">
            Conformidade LGPD
          </h4>
          <ul className="mt-2 space-y-1">
            <li className="flex items-center">
              <span className={`w-4 h-4 rounded-full mr-2 ${
                lgpdCompliance.hasPersonalData ? 'bg-yellow-500' : 'bg-green-500'
              }`} />
              Dados Pessoais: {lgpdCompliance.hasPersonalData ? 'Detectados' : 'Não Detectados'}
            </li>
            <li className="flex items-center">
              <span className={`w-4 h-4 rounded-full mr-2 ${
                lgpdCompliance.hasConsentMessage ? 'bg-green-500' : 'bg-red-500'
              }`} />
              Mensagem de Consentimento: {lgpdCompliance.hasConsentMessage ? 'Presente' : 'Ausente'}
            </li>
          </ul>
        </div>
      )}

      {/* Action buttons */}
      <div className="flex justify-end space-x-3">
        <Button
          variant="outline"
          onClick={onPreview}
          disabled={disabled || !lgpdCompliance.isCompliant}
        >
          Visualizar
        </Button>
        <Button
          variant="primary"
          onClick={onSave}
          disabled={disabled || !lgpdCompliance.isCompliant || Object.keys(errors).length > 0}
        >
          Salvar Template
        </Button>
      </div>
    </div>
  );
};

export default TemplateEditor;