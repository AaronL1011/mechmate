<script lang="ts">
  import type { Equipment, TaskType, EquipmentType } from '$lib/types/db.js';

  interface Props {
    isOpen: boolean;
    onClose: () => void;
    equipment: Equipment[];
    taskTypes: TaskType[];
    equipmentTypes: EquipmentType[];
  }

  const { isOpen, onClose, equipment, taskTypes, equipmentTypes }: Props = $props();

  // Component state
  let input = $state('');
  let workflowContext = $state<'auto_detect' | 'vehicle' | 'tool' | 'appliance' | 'task'>('auto_detect');
  let currentStep = $state(1);
  let totalSteps = $state(3);
  let extractedData = $state<Record<string, any>>({});
  let isProcessing = $state(false);
  let nextPrompt = $state('Define some new equipment, schedule a task or pick from suggestions');
  let quickOptions = $state<Array<{label: string; value: string; icon: string}>>([]);
  let validationErrors = $state<string[]>([]);
  let readyToCreate = $state(false);

  let textareaElement: HTMLTextAreaElement | null = $state(null);

  $effect(() => {
    if (isOpen && textareaElement && workflowContext && currentStep) {
      textareaElement.focus();
    }
  })

  // Mock workflow detection and processing
  function detectWorkflow(text: string) {
    // fetch intention endpoint, 
    const lowerText = text.toLowerCase();
    
    if (/\b(car|truck|vehicle|honda|toyota|ford|chevy|bmw|audi|civic|camry|f150)\b/.test(lowerText)) {
      return 'vehicle';
    } else if (/\b(drill|saw|compressor|welder|grinder|hammer|wrench|screwdriver)\b/.test(lowerText)) {
      return 'tool';
    } else if (/\b(washer|dryer|refrigerator|dishwasher|oven|ac|hvac|fridge)\b/.test(lowerText)) {
      return 'appliance';
    } else if (/\b(change|replace|service|maintain|check|inspect|oil|filter|tire)\b/.test(lowerText)) {
      return 'task';
    }
    return 'auto_detect';
  }

  function processInput() {
    if (!input.trim()) return;
    
    isProcessing = true;
    
    // Simulate processing delay
    setTimeout(() => {
      const detectedWorkflow = detectWorkflow(input);
      
      if (workflowContext === 'auto_detect') {
        workflowContext = detectedWorkflow;
      }
      
      processWorkflowStep(input, workflowContext);
      isProcessing = false;
    }, 300);
  }

  function advanceStep() {
    if (workflowContext === 'vehicle' && currentStep === 1 && extractedData.make && extractedData.model) {
      currentStep = 2;
      nextPrompt = "What year and current mileage?";
      quickOptions = [
        { label: "2020", value: "2020", icon: "📅" },
        { label: "2015", value: "2015", icon: "📅" },
        { label: "2010", value: "2010", icon: "📅" }
      ];
      input = '';
    } else if (workflowContext === 'vehicle' && currentStep === 2 && (extractedData.year || extractedData.current_mileage)) {
      currentStep = 3;
      totalSteps = 3;
      nextPrompt = "Ready to create your vehicle?";
      readyToCreate = true;
      quickOptions = [];
      input = '';
    } else if (workflowContext === 'tool' && currentStep === 1 && extractedData.name) {
      currentStep = 2;
      nextPrompt = "What make and model?";
      quickOptions = [
        { label: "DeWalt", value: "DeWalt", icon: "🔧" },
        { label: "Milwaukee", value: "Milwaukee", icon: "🔧" },
        { label: "Makita", value: "Makita", icon: "🔧" }
      ];
      input = '';
    } else if (workflowContext === 'tool' && currentStep === 2 && extractedData.make) {
      currentStep = 3;
      nextPrompt = "How do you track usage?";
      quickOptions = [
        { label: "Hours", value: "hours", icon: "⏱️" },
        { label: "Projects", value: "projects", icon: "📋" },
        { label: "Cycles", value: "cycles", icon: "🔄" }
      ];
      input = '';
    } else if (workflowContext === 'tool' && currentStep === 3 && extractedData.usage_unit) {
      readyToCreate = true;
      nextPrompt = "Ready to create your tool?";
      quickOptions = [];
      input = '';
    } else if (workflowContext === 'appliance' && currentStep === 1 && extractedData.name) {
      currentStep = 2;
      nextPrompt = "What make and model?";
      quickOptions = [
        { label: "Whirlpool", value: "Whirlpool", icon: "🏠" },
        { label: "GE", value: "GE", icon: "🏠" },
        { label: "Samsung", value: "Samsung", icon: "🏠" }
      ];
      input = '';
    } else if (workflowContext === 'appliance' && currentStep >= 2 && extractedData.make) {
      extractedData.usage_unit = 'months';
      readyToCreate = true;
      nextPrompt = "Ready to create your appliance?";
      quickOptions = [];
      input = '';
    } else if (workflowContext === 'task' && currentStep === 1 && extractedData.title) {
      currentStep = 2;
      nextPrompt = "For which equipment?";
      quickOptions = equipment.slice(0, 3).map(eq => ({
        label: eq.name,
        value: eq.name,
        icon: "🔧"
      }));
      input = '';
    } else if (workflowContext === 'task' && currentStep === 2 && extractedData.equipment_id) {
      currentStep = 3;
      nextPrompt = "How often?";
      quickOptions = [
        { label: "Every 3,000 km", value: "3000 km", icon: "🚗" },
        { label: "Every 6 months", value: "6 months", icon: "📅" },
        { label: "Monthly", value: "monthly", icon: "📆" }
      ];
      input = '';
    } else if (workflowContext === 'task' && currentStep === 3 && (extractedData.interval_value || extractedData.interval_unit)) {
      readyToCreate = true;
      nextPrompt = "Ready to create your task?";
      quickOptions = [];
      input = '';
    }
  }

  function processWorkflowStep(text: string, workflow: string) {
    switch (workflow) {
      case 'vehicle':
        processVehicleWorkflow(text);
        break;
      case 'tool':
        processToolWorkflow(text);
        break;
      case 'appliance':
        processApplianceWorkflow(text);
        break;
      case 'task':
        processTaskWorkflow(text);
        break;
      default:
        // Keep default state
        break;
    }
  }

  function processVehicleWorkflow(text: string) {
    if (currentStep === 1) {
      // Extract make and model
      const makeModelMatch = text.match(/\b(honda|toyota|ford|chevy|bmw|audi|nissan|mazda)\s+(\w+)/i);
      if (makeModelMatch) {
        extractedData.make = makeModelMatch[1];
        extractedData.model = makeModelMatch[2];
        // Don't auto-advance - wait for user confirmation
      }
    } else if (currentStep === 2) {
      // Extract year and mileage
      const yearMatch = text.match(/\b(19|20)\d{2}\b/);
      const mileageMatch = text.match(/\b(\d+)\s*(km?|km|kilometers?)\b/i);
      
      if (yearMatch) {
        extractedData.year = parseInt(yearMatch[0]);
      }
      if (mileageMatch) {
        extractedData.current_mileage = parseInt(mileageMatch[1]);
        extractedData.usage_unit = mileageMatch[2].toLowerCase().includes('km') ? 'km' : 'km';
      }
      // Don't auto-advance - wait for user confirmation
    }
  }

  function processToolWorkflow(text: string) {
    if (currentStep === 1) {
      const toolMatch = text.match(/\b(drill|saw|compressor|welder|grinder|hammer|wrench|screwdriver)\b/i);
      if (toolMatch) {
        extractedData.name = text;
        extractedData.type = 'tool';
        // Don't auto-advance - wait for user confirmation
      }
    } else if (currentStep === 2) {
      if (text.trim()) {
        extractedData.make = text;
        // Don't auto-advance - wait for user confirmation
      }
    } else if (currentStep === 3) {
      if (text.trim()) {
        extractedData.usage_unit = text;
        // Don't auto-advance - wait for user confirmation
      }
    }
  }

  function processApplianceWorkflow(text: string) {
    if (currentStep === 1) {
      extractedData.name = text;
      extractedData.type = 'appliance';
      // Don't auto-advance - wait for user confirmation
    } else if (currentStep >= 2) {
      if (text.trim()) {
        extractedData.make = text;
        extractedData.usage_unit = 'months';
        // Don't auto-advance - wait for user confirmation
      }
    }
  }

  function processTaskWorkflow(text: string) {
    if (currentStep === 1) {
      extractedData.title = text;
      // Don't auto-advance - wait for user confirmation
    } else if (currentStep === 2) {
      const selectedEquipment = equipment.find(eq => 
        eq.name.toLowerCase().includes(text.toLowerCase())
      );
      if (selectedEquipment) {
        extractedData.equipment_id = selectedEquipment.id;
        extractedData.equipment_name = selectedEquipment.name;
        // Don't auto-advance - wait for user confirmation
      }
    } else if (currentStep === 3) {
      const intervalMatch = text.match(/(\d+)\s*(km?|months?|days?|weeks?)/i);
      if (intervalMatch) {
        extractedData.interval_value = parseInt(intervalMatch[1]);
        extractedData.interval_unit = intervalMatch[2];
        // Don't auto-advance - wait for user confirmation
      }
    }
  }

  function setWorkflowContext(context: typeof workflowContext) {
    workflowContext = context;
    currentStep = 1;
    extractedData = {};
    readyToCreate = false;
    
    switch (context) {
      case 'vehicle':
        nextPrompt = "Which vehicle?";
        quickOptions = [
          { label: "Honda Civic", value: "Honda Civic", icon: "🚗" },
          { label: "Toyota Camry", value: "Toyota Camry", icon: "🚗" },
          { label: "Ford F-150", value: "Ford F-150", icon: "🚛" }
        ];
        break;
      case 'tool':
        nextPrompt = "What tool or equipment?";
        quickOptions = [
          { label: "Drill", value: "Drill", icon: "🔧" },
          { label: "Saw", value: "Saw", icon: "🪚" },
          { label: "Compressor", value: "Air compressor", icon: "💨" }
        ];
        break;
      case 'appliance':
        nextPrompt = "What appliance?";
        quickOptions = [
          { label: "Refrigerator", value: "Refrigerator", icon: "🧊" },
          { label: "Washer", value: "Washing machine", icon: "🧺" },
          { label: "HVAC", value: "HVAC system", icon: "❄️" }
        ];
        break;
      case 'task':
        nextPrompt = "What maintenance task?";
        quickOptions = [
          { label: "Oil Change", value: "Oil change", icon: "🛢️" },
          { label: "Tire Rotation", value: "Tire rotation", icon: "🛞" },
          { label: "Filter Change", value: "Filter change", icon: "🔧" }
        ];
        break;
    }
  }

  function getContextPlaceholder(context: string) {
    switch (context) {
      case 'vehicle': return "e.g. '2015 Honda Civic with 85,000 km'";
      case 'tool': return "e.g. 'DeWalt cordless drill'";
      case 'appliance': return "e.g. 'Whirlpool refrigerator'";
      case 'task': return "e.g. 'Oil change every 3,000 km'";
      default: return "e.g. '2015 Honda Civic' or 'Oil change every 3000 km on the bike'";
    }
  }

  function handleKeyDown(event: KeyboardEvent) {
    if (event.key === 'Enter' && !event.shiftKey) {
      event.preventDefault();
      if (readyToCreate) {
        handleCreate();
      } else if (canAdvanceStep()) {
        advanceStep();
      } else {
        processInput();
      }
    } else if (event.key === 'Escape') {
      onClose();
    }
  }

  function canAdvanceStep(): boolean {
    if (workflowContext === 'vehicle') {
      if (currentStep === 1) return extractedData.make && extractedData.model;
      if (currentStep === 2) return extractedData.year || extractedData.current_mileage;
    } else if (workflowContext === 'tool') {
      if (currentStep === 1) return extractedData.name;
      if (currentStep === 2) return extractedData.make;
      if (currentStep === 3) return extractedData.usage_unit;
    } else if (workflowContext === 'appliance') {
      if (currentStep === 1) return extractedData.name;
      if (currentStep === 2) return extractedData.make;
    } else if (workflowContext === 'task') {
      if (currentStep === 1) return extractedData.title;
      if (currentStep === 2) return extractedData.equipment_id;
      if (currentStep === 3) return extractedData.interval_value || extractedData.interval_unit;
    }
    return false;
  }

  function getNextButtonText(): string {
    if (readyToCreate) return 'Create';
    if (canAdvanceStep()) return 'Next';
    return 'Confirm';
  }

  function handleCreate() {
    console.log('Creating with data:', extractedData);
    // TODO: Implement actual creation logic
    alert(`Mock creation: ${JSON.stringify(extractedData, null, 2)}`);
    onClose();
  }

  function goBack() {
    if (currentStep > 1) {
      currentStep--;
      readyToCreate = false;
      
      // Restore previous step state based on workflow and step
      if (workflowContext === 'vehicle') {
        if (currentStep === 1) {
          nextPrompt = "Which vehicle?";
          quickOptions = [
            { label: "Honda Civic", value: "Honda Civic", icon: "🚗" },
            { label: "Toyota Camry", value: "Toyota Camry", icon: "🚗" },
            { label: "Ford F-150", value: "Ford F-150", icon: "🚛" }
          ];
          // Clear step 2+ data
          delete extractedData.year;
          delete extractedData.current_mileage;
          delete extractedData.usage_unit;
        } else if (currentStep === 2) {
          nextPrompt = "What year and current mileage?";
          quickOptions = [
            { label: "2020", value: "2020", icon: "📅" },
            { label: "2015", value: "2015", icon: "📅" },
            { label: "2010", value: "2010", icon: "📅" }
          ];
          // Clear step 3+ data but keep step 1 data
          delete extractedData.year;
          delete extractedData.current_mileage;
          delete extractedData.usage_unit;
        }
      } else if (workflowContext === 'tool') {
        if (currentStep === 1) {
          nextPrompt = "What tool or equipment?";
          quickOptions = [
            { label: "Drill", value: "Drill", icon: "🔧" },
            { label: "Saw", value: "Saw", icon: "🪚" },
            { label: "Compressor", value: "Air compressor", icon: "💨" }
          ];
          delete extractedData.make;
          delete extractedData.usage_unit;
        } else if (currentStep === 2) {
          nextPrompt = "What make and model?";
          quickOptions = [
            { label: "DeWalt", value: "DeWalt", icon: "🔧" },
            { label: "Milwaukee", value: "Milwaukee", icon: "🔧" },
            { label: "Makita", value: "Makita", icon: "🔧" }
          ];
          delete extractedData.usage_unit;
        }
      } else if (workflowContext === 'appliance') {
        if (currentStep === 1) {
          nextPrompt = "What appliance?";
          quickOptions = [
            { label: "Refrigerator", value: "Refrigerator", icon: "🧊" },
            { label: "Washer", value: "Washing machine", icon: "🧺" },
            { label: "HVAC", value: "HVAC system", icon: "❄️" }
          ];
          delete extractedData.make;
          delete extractedData.usage_unit;
        }
      } else if (workflowContext === 'task') {
        if (currentStep === 1) {
          nextPrompt = "What maintenance task?";
          quickOptions = [
            { label: "Oil Change", value: "Oil change", icon: "🛢️" },
            { label: "Tire Rotation", value: "Tire rotation", icon: "🛞" },
            { label: "Filter Change", value: "Filter change", icon: "🔧" }
          ];
          delete extractedData.equipment_id;
          delete extractedData.equipment_name;
          delete extractedData.interval_value;
          delete extractedData.interval_unit;
        } else if (currentStep === 2) {
          nextPrompt = "For which equipment?";
          quickOptions = equipment.slice(0, 3).map(eq => ({
            label: eq.name,
            value: eq.name,
            icon: "🔧"
          }));
          delete extractedData.interval_value;
          delete extractedData.interval_unit;
        }
      }
      
      extractedData = { ...extractedData }; // Trigger reactivity
      input = '';
    }
  }

  function removeDataField(key: string) {
    delete extractedData[key];
    extractedData = { ...extractedData };
  }
</script>

{#if isOpen}
  <div class="fixed inset-0 z-50 flex items-center justify-center bg-gray-100/60 dark:bg-gray-900/60 backdrop-blur-md animate-in fade-in duration-200">
    <div class="w-full max-w-lg mx-4 p-6 animate-in zoom-in-95 duration-200">
      <div class="mb-6">
        <h2 class="text-xl font-semibold text-gray-900 dark:text-white mb-2">Quick Edit</h2>
        <p class="text-sm text-gray-600 dark:text-gray-400">
          {nextPrompt}
        </p>
      </div>
      
      <!-- Workflow shortcuts -->
      {#if workflowContext === 'auto_detect'}
        <div class="flex flex-wrap gap-2 mb-4">
          <button 
            class="px-3 py-1 text-xs bg-blue-100 dark:bg-blue-900/30 text-blue-800 dark:text-blue-200 rounded-full hover:bg-blue-200 dark:hover:bg-blue-900/50 transition-colors" 
            onclick={() => setWorkflowContext('vehicle')}
          >
            🚗 Vehicle
          </button>
          <button 
            class="px-3 py-1 text-xs bg-green-100 dark:bg-green-900/30 text-green-800 dark:text-green-200 rounded-full hover:bg-green-200 dark:hover:bg-green-900/50 transition-colors" 
            onclick={() => setWorkflowContext('tool')}
          >
            🔧 Tool
          </button>
          <button 
            class="px-3 py-1 text-xs bg-purple-100 dark:bg-purple-900/30 text-purple-800 dark:text-purple-200 rounded-full hover:bg-purple-200 dark:hover:bg-purple-900/50 transition-colors" 
            onclick={() => setWorkflowContext('appliance')}
          >
            🏠 Appliance
          </button>
          <button 
            class="px-3 py-1 text-xs bg-orange-100 dark:bg-orange-900/30 text-orange-800 dark:text-orange-200 rounded-full hover:bg-orange-200 dark:hover:bg-orange-900/50 transition-colors" 
            onclick={() => setWorkflowContext('task')}
          >
            📋 Task
          </button>
        </div>
      {/if}
      
      <textarea
        bind:this={textareaElement}
        bind:value={input}
        rows={3}
        placeholder={getContextPlaceholder(workflowContext)}
        class="resize-none w-full px-6 py-4 text-md lg:text-lg bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-2xl shadow-sm focus:ring focus:ring-blue-500 focus:border-blue-500 transition-colors"
        onkeydown={handleKeyDown}
      ></textarea>
      
      <!-- Quick options -->
      {#if quickOptions.length > 0}
        <div class="flex flex-wrap gap-2 mt-3">
          {#each quickOptions as option}
            <button 
              class="px-3 py-1 text-sm bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors"
              onclick={() => { input = option.value; processInput(); }}
            >
              {option.icon} {option.label}
            </button>
          {/each}
        </div>
      {/if}
      
      <!-- Extracted data preview -->
      {#if Object.keys(extractedData).length > 0}
        <div class="mt-4 p-3 bg-blue-50 dark:bg-blue-900/20 rounded-lg">
          <div class="flex flex-wrap gap-2">
            {#each Object.entries(extractedData) as [key, value]}
              {#if value && key !== 'equipment_id'}
                <span class="inline-flex items-center gap-1 px-2 py-1 bg-blue-100 dark:bg-blue-900/40 text-blue-800 dark:text-blue-200 rounded text-xs">
                  {key.replace(/_/g, ' ')}: {value}
                  <button 
                    class="hover:bg-blue-200 dark:hover:bg-blue-900/60 rounded-full p-0.5 transition-colors"
                    onclick={() => removeDataField(key)}
                  >
                    ×
                  </button>
                </span>
              {/if}
            {/each}
          </div>
        </div>
      {/if}
      
      <!-- Validation errors -->
      {#if validationErrors.length > 0}
        <div class="mt-4 p-3 bg-red-50 dark:bg-red-900/20 rounded-lg">
          {#each validationErrors as error}
            <p class="text-red-800 dark:text-red-200 text-sm">{error}</p>
          {/each}
        </div>
      {/if}
      
      <div class="flex justify-between mt-6">
        <button 
          onclick={onClose} 
          class="px-4 py-2 text-gray-600 dark:text-gray-400 hover:text-gray-800 dark:hover:text-gray-200 transition-colors"
        >
          Cancel
        </button>
        <div class="flex gap-2">
          {#if currentStep > 1 && workflowContext !== 'auto_detect'}
            <button 
              class="px-4 py-2 text-blue-600 dark:text-blue-400 hover:text-blue-800 dark:hover:text-blue-200 transition-colors"
              onclick={goBack}
            >
              Back
            </button>
          {/if}
          <button 
            disabled={(!input.trim() && !canAdvanceStep() && !readyToCreate) || isProcessing}
            class="px-6 py-2 bg-blue-600 hover:bg-blue-700 dark:bg-blue-700 dark:hover:bg-blue-600 text-white rounded-lg disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            onclick={() => {
              if (readyToCreate) {
                handleCreate();
              } else if (canAdvanceStep()) {
                advanceStep();
              } else {
                processInput();
              }
            }}
          >
            {isProcessing ? 'Processing...' : getNextButtonText()}
          </button>
        </div>
      </div>
    </div>
  </div>
{/if}
