import { FC, useState } from 'react'
import { Modal, ModalContent, ModalHeader, ModalBody, ModalFooter } from '@nextui-org/modal'
import { Button } from '@nextui-org/button'
import { Input } from '@nextui-org/input'
import { LLMService } from '@/services/llm-service'

interface LLMConfigProps {
  isOpen: boolean
  onClose: () => void
}

export const LLMConfig: FC<LLMConfigProps> = ({ isOpen, onClose }) => {
  const [ollamaUrl, setOllamaUrl] = useState('http://localhost:11434')
  const [error, setError] = useState<string | null>(null)

  const handleSave = () => {
    try {
      LLMService.getInstance().setOllamaUrl(ollamaUrl)
      onClose()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save Ollama URL')
    }
  }

  return (
    <Modal isOpen={isOpen} onClose={onClose}>
      <ModalContent>
        <ModalHeader>Configure AI Analysis</ModalHeader>
        <ModalBody>
          <Input
            label="Ollama URL"
            type="text"
            value={ollamaUrl}
            onChange={(e) => setOllamaUrl(e.target.value)}
            placeholder="Enter Ollama URL (default: http://localhost:11434)"
            errorMessage={error}
            isInvalid={!!error}
          />
          <p className="text-sm text-muted-foreground mt-2">
            Make sure Ollama is running and the specified model (e.g., codellama) is pulled.
          </p>
        </ModalBody>
        <ModalFooter>
          <Button color="danger" variant="light" onPress={onClose}>
            Cancel
          </Button>
          <Button color="primary" onPress={handleSave}>
            Save
          </Button>
        </ModalFooter>
      </ModalContent>
    </Modal>
  )
} 