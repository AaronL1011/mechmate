<script lang="ts">
  import type { CreateEquipmentRequest, EquipmentType } from '$lib/types/db.js';
	import AutocompleteSelect from './AutocompleteSelect.svelte';

  let { equipmentCreated, isOpen, equipmentTypes, onCloseModal }: {
    equipmentCreated: (equipment: CustomEvent) => void;
    isOpen: boolean;
    equipmentTypes: EquipmentType[];
    onCloseModal: () => void;
  } = $props();

  interface CreateEquipmentFormData extends Omit<CreateEquipmentRequest, 'equipment_type_id'> {
    equipment_type_id: number | undefined;
  }
  
  let formData: CreateEquipmentFormData = $state({
    name: '',
    type: '',
    equipment_type_id: undefined,
    make: '',
    model: '',
    year: undefined,
    serial_number: '',
    purchase_date: '',
    current_usage_value: 0,
    usage_unit: '',
    metadata: {},
    tags: []
  });
  
  let loading = $state(false);
  let error = $state('');
  let typeCreateLoading = $state(false);
  let typeCreateError = $state('');
  
  async function handleSubmit() {
    if (!formData.name || formData.equipment_type_id === undefined || !formData.usage_unit) {
      error = 'Name, type, and usage unit are required';
      return;
    }
    
    try {
      loading = true;
      error = '';
      
      const response = await fetch('/api/equipment', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(formData)
      });
      
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to create equipment');
      }
      
      const equipment = await response.json();
      equipmentCreated(equipment);
      closeModal();
    } catch (err) {
      error = err instanceof Error ? err.message : 'Failed to create equipment';
    } finally {
      loading = false;
    }
  }
  
  function closeModal() {
    isOpen = false;
    // Reset form
    formData = {
      name: '',
      type: '',
      equipment_type_id: undefined,
      make: '',
      model: '',
      year: undefined,
      serial_number: '',
      purchase_date: '',
      current_usage_value: 0,
      usage_unit: '',
      metadata: {},
      tags: []
    };
    error = '';
    onCloseModal();
  }
  
  function handleBackdropClick(event: MouseEvent) {
    if (event.target === event.currentTarget) {
      closeModal();
    }
  }

  async function handleEquipmentTypeCreate(name: string) {
    try {
      typeCreateLoading = true;
      typeCreateError = '';

      const equipmentTypeRes = await fetch('/api/equipment-types',{
        method: 'POST',
        body: JSON.stringify({ name })
      })

      if (!equipmentTypeRes.ok) {
        const errorData = await equipmentTypeRes.json();
        throw new Error(errorData.error || 'Failed to create equipment type');
      }

      const equipmentTypeData = await equipmentTypeRes.json() as { id: number; name: string };
      formData.equipment_type_id = equipmentTypeData.id;

      if (!equipmentTypes.find(et => et.id === equipmentTypeData.id)) {
        equipmentTypes = [equipmentTypeData, ...equipmentTypes]
      }
    } catch (err) {
      typeCreateError = err instanceof Error ? err.message : 'Failed to create equipment type';
    } finally {
      typeCreateLoading = false;
    }
  }
</script>

{#if isOpen}
  <div class="fixed flex items-center justify-center inset-0 bg-gray-600/50 dark:bg-gray-900/50 backdrop-blur-sm overflow-y-auto h-dvh w-full z-50" onclick={handleBackdropClick} role="dialog" aria-modal="true" tabindex="-1" onkeydown={(e) => e.key === 'Escape' && closeModal()}>
    <div class="relative p-5 border border-gray-200 dark:border-gray-700 max-w-xl shadow-lg dark:shadow-gray-900/50 rounded-md bg-white dark:bg-gray-800 h-fit max-h-[90vh]">
      <div class="mt-3">
        <div class="flex items-center justify-between mb-4">
          <h3 class="text-lg font-medium text-gray-900 dark:text-white">Add New Equipment</h3>
          <button 
            type="button" 
            class="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
            onclick={closeModal}
            aria-label="Close"
          >
            <svg class="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"></path>
            </svg>
          </button>
        </div>
        
        <form onsubmit={handleSubmit} class="space-y-4">
          {#if error}
            <div class="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-md p-3">
              <p class="text-sm text-red-800 dark:text-red-200">{error}</p>
            </div>
          {/if}
          
          <div>
            <label for="name" class="block text-sm font-medium text-gray-700 dark:text-gray-300">Name *</label>
            <input
              type="text"
              id="name"
              bind:value={formData.name}
              class="mt-1 block w-full border border-gray-300 dark:border-gray-600 rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 dark:bg-gray-700 dark:text-white dark:placeholder-gray-400"
              placeholder="e.g., My Car, Coffee Machine"
              required
            />
          </div>
          
          <AutocompleteSelect options={equipmentTypes} bind:value={formData.equipment_type_id} onCreate={handleEquipmentTypeCreate} />
          
          <div class="grid grid-cols-2 gap-4">
            <div>
              <label for="make" class="block text-sm font-medium text-gray-700 dark:text-gray-300">Make</label>
              <input
                type="text"
                id="make"
                bind:value={formData.make}
                class="mt-1 block w-full border border-gray-300 dark:border-gray-600 rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 dark:bg-gray-700 dark:text-white dark:placeholder-gray-400"
                placeholder="e.g. Toyota, Breville"
              />
            </div>
            
            <div>
              <label for="model" class="block text-sm font-medium text-gray-700 dark:text-gray-300">Model</label>
              <input
                type="text"
                id="model"
                bind:value={formData.model}
                class="mt-1 block w-full border border-gray-300 dark:border-gray-600 rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 dark:bg-gray-700 dark:text-white dark:placeholder-gray-400"
                placeholder="e.g. Camry, BES870XL"
              />
            </div>
          </div>
          
          <div class="grid grid-cols-2 gap-4">
            <div>
              <label for="year" class="block text-sm font-medium text-gray-700 dark:text-gray-300">Year</label>
              <input
                type="number"
                id="year"
                bind:value={formData.year}
                class="mt-1 block w-full border border-gray-300 dark:border-gray-600 rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 dark:bg-gray-700 dark:text-white dark:placeholder-gray-400"
                placeholder="e.g. 2020"
                min="1900"
                max={new Date().getFullYear() + 1}
              />
            </div>
            
            <div>
              <label for="serial_number" class="block text-sm font-medium text-gray-700 dark:text-gray-300">Serial Number</label>
              <input
                type="text"
                id="serial_number"
                bind:value={formData.serial_number}
                class="mt-1 block w-full border border-gray-300 dark:border-gray-600 rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 dark:bg-gray-700 dark:text-white dark:placeholder-gray-400"
                placeholder="Optional"
              />
            </div>
          </div>
          
          <div>
            <label for="purchase_date" class="block text-sm font-medium text-gray-700 dark:text-gray-300">Purchase Date</label>
            <input
              type="date"
              id="purchase_date"
              bind:value={formData.purchase_date}
              class="mt-1 block w-full border border-gray-300 dark:border-gray-600 rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 dark:bg-gray-700 dark:text-white"
            />
          </div>
          
          <div class="grid grid-cols-2 gap-4">
            <div>
              <label for="current_usage_value" class="block text-sm font-medium text-gray-700 dark:text-gray-300">Current Usage</label>
              <input
                type="number"
                id="current_usage_value"
                bind:value={formData.current_usage_value}
                class="mt-1 block w-full border border-gray-300 dark:border-gray-600 rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 dark:bg-gray-700 dark:text-white dark:placeholder-gray-400"
                placeholder="0"
                min="0"
                step="0.1"
              />
            </div>
            
            <div>
              <label for="usage_unit" class="block text-sm font-medium text-gray-700 dark:text-gray-300">Usage Unit *</label>
              <input
                type="text"
                id="usage_unit"
                bind:value={formData.usage_unit}
                class="mt-1 block w-full border border-gray-300 dark:border-gray-600 rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 dark:bg-gray-700 dark:text-white dark:placeholder-gray-400"
                placeholder="e.g. km, hours"
                required
              />
            </div>
          </div>
          
          <div class="flex justify-end space-x-3 pt-4">
            <button
              type="button"
              onclick={closeModal}
              class="px-4 py-2 text-sm font-medium text-gray-700 dark:text-gray-300 bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-md hover:bg-gray-50 dark:hover:bg-gray-600 focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={loading}
              class="px-4 py-2 text-sm font-medium text-white bg-blue-600 dark:bg-blue-700 border border-transparent rounded-md hover:bg-blue-700 dark:hover:bg-blue-600 focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {loading ? 'Adding...' : 'Add Equipment'}
            </button>
          </div>
        </form>
      </div>
    </div>
  </div>
{/if} 