<script lang="ts">
  import { onMount } from 'svelte';
  import type { Equipment, EquipmentType } from '$lib/types/db.js';
  import EditEquipmentModal from '$lib/components/EditEquipmentModal.svelte';
  import DeleteConfirmationModal from '$lib/components/DeleteConfirmationModal.svelte';
  
  let equipment: Equipment[] = [];
  let equipmentTypes: EquipmentType[] = [];
  let loading = true;
  let error = '';
  
  // Modal states
  let showEditModal = false;
  let showDeleteModal = false;
  let selectedEquipment: Equipment | null = null;
  
  async function loadEquipment() {
    try {
      loading = true;
      const [equipmentRes, equipmentTypesRes] = await Promise.all([
        fetch('/api/equipment'),
        fetch('/api/equipment-types')
      ])
      
      if (!equipmentRes.ok || !equipmentTypesRes.ok) {
        throw new Error('Failed to load equipment');
      }
      
      equipment = await equipmentRes.json();
      equipmentTypes = await equipmentTypesRes.json();
    } catch (err) {
      error = 'Failed to load equipment data';
      console.error(err);
    } finally {
      loading = false;
    }
  }
  
  function openEditModal(equipmentItem: Equipment) {
    selectedEquipment = equipmentItem;
    showEditModal = true;
  }
  
  function openDeleteModal(equipmentItem: Equipment) {
    selectedEquipment = equipmentItem;
    showDeleteModal = true;
  }
  
  function handleEquipmentUpdated(updatedEquipment: Equipment) {
    equipment = equipment.map(eq => eq.id === updatedEquipment.id ? updatedEquipment : eq);
    showEditModal = false;
    selectedEquipment = null;
  }
  
  function handleEquipmentDeleted(event: CustomEvent) {
    const deletedId = event.detail;
    equipment = equipment.filter(eq => eq.id !== deletedId);
    showDeleteModal = false;
    selectedEquipment = null;
  }
  
  async function handleDeleteConfirm() {
    if (!selectedEquipment) return;
    
    try {
      const response = await fetch(`/api/equipment/${selectedEquipment.id}`, {
        method: 'DELETE'
      });
      
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to delete equipment');
      }
      
      handleEquipmentDeleted({ detail: selectedEquipment.id } as CustomEvent);
    } catch (err) {
      console.error('Error deleting equipment:', err);
      // You could show an error message here
    }
  }
  
  function formatDate(dateString: string | null): string {
    if (!dateString) return 'Not specified';
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric'
    });
  }
  
  function parseMetadata(metadata: string | null): Record<string, any> {
    if (!metadata) return {};
    try {
      return JSON.parse(metadata);
    } catch {
      return {};
    }
  }
  
  function parseTags(tags: string | null): string[] {
    if (!tags) return [];
    try {
      return JSON.parse(tags);
    } catch {
      return [];
    }
  }
  
  onMount(() => {
    loadEquipment();
  });
</script>

<svelte:head>
  <title>Equipment Management - Mechmate</title>
</svelte:head>

<div class="min-h-screen bg-gray-50 dark:bg-gray-900 px-4 sm:px-6 lg:px-8 py-8">
  <!-- Header -->
  <header class="max-w-7xl mx-auto mb-8">
    <div class="flex items-center gap-4 mb-4">
      <a href="/" class="text-blue-600 hover:text-blue-800 dark:text-blue-400 dark:hover:text-blue-300" aria-label="return to dashboard">
        <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" fill="currentColor" viewBox="0 0 256 256">
          <path d="M224,128a8,8,0,0,1-8,8H59.31l58.35,58.34a8,8,0,0,1-11.32,11.32l-72-72a8,8,0,0,1,0-11.32l72-72a8,8,0,0,1,11.32,11.32L59.31,120H216A8,8,0,0,1,224,128Z"></path>
        </svg>
      </a>
      <div>
        <h1 class="text-2xl lg:text-3xl font-bold text-gray-900 dark:text-white">Equipment Management</h1>
        <p class="text-gray-600 dark:text-gray-300">Manage your equipment inventory</p>
      </div>
    </div>
  </header>

  <main class="max-w-7xl mx-auto">
    {#if loading}
      <div class="flex justify-center items-center py-12">
        <div class="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 dark:border-blue-400"></div>
      </div>
    {:else if error}
      <div class="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-4">
        <p class="text-red-800 dark:text-red-200">{error}</p>
        <button on:click={loadEquipment} class="mt-2 text-red-600 dark:text-red-400 hover:text-red-800 dark:hover:text-red-200 underline">
          Try again
        </button>
      </div>
    {:else if equipment.length === 0}
      <div class="bg-white dark:bg-gray-800 rounded-lg shadow dark:shadow-gray-900/20 p-12 text-center">
        <!-- <svg xmlns="http://www.w3.org/2000/svg" class="mx-auto h-12 w-12 text-gray-400 dark:text-gray-500" fill="currentColor" viewBox="0 0 256 256"><path d="M208,88H48a16,16,0,0,0-16,16v96a16,16,0,0,0,16,16H208a16,16,0,0,0,16-16V104A16,16,0,0,0,208,88Zm0,112H48V104H208v96ZM48,64a8,8,0,0,1,8-8H200a8,8,0,0,1,0,16H56A8,8,0,0,1,48,64ZM64,32a8,8,0,0,1,8-8H184a8,8,0,0,1,0,16H72A8,8,0,0,1,64,32Z"></path></svg> -->
        <svg xmlns="http://www.w3.org/2000/svg" class="mx-auto h-12 w-12 text-gray-400 dark:text-gray-500" fill="currentColor" viewBox="0 0 256 256"><path d="M240,192h-8V98.67a16,16,0,0,0-7.12-13.31l-88-58.67a16,16,0,0,0-17.75,0l-88,58.67A16,16,0,0,0,24,98.67V192H16a8,8,0,0,0,0,16H240a8,8,0,0,0,0-16ZM40,98.67,128,40l88,58.66V192H192V136a8,8,0,0,0-8-8H72a8,8,0,0,0-8,8v56H40ZM176,144v16H136V144Zm-56,16H80V144h40ZM80,176h40v16H80Zm56,0h40v16H136Z"></path></svg>
        <h3 class="mt-2 text-sm font-medium text-gray-900 dark:text-white">No equipment found</h3>
        <p class="mt-1 text-sm text-gray-500 dark:text-gray-400">Get started by adding some equipment to your inventory.</p>
        <div class="mt-6">
          <a 
            href="/"
            class="bg-blue-600 hover:bg-blue-700 dark:bg-blue-700 dark:hover:bg-blue-600 text-white px-4 py-2 rounded-lg font-medium transition-colors"
          >
            Add your first equipment
          </a>
        </div>
      </div>
    {:else}
      <div class="bg-white dark:bg-gray-800 shadow dark:shadow-gray-900/20 overflow-hidden rounded-lg">
        <ul class="divide-y divide-gray-200 dark:divide-gray-700">
          {#each equipment as equipmentItem}
            <li class="px-6 py-4 hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors">
              <div class="flex items-center justify-between flex-wrap gap-y-4">
                <div class="flex items-center flex-1 min-w-[400px]">
                  <div class="ml-4 flex-1">
                    <div class="flex items-center justify-between">
                      <div>
                        <h3 class="text-lg font-medium text-gray-900 dark:text-white">{equipmentItem.name}</h3>
                        <div class="flex items-center space-x-4 text-sm text-gray-600 dark:text-gray-300">
                          <span class="capitalize">{equipmentItem.type}</span>
                          {#if equipmentItem.make || equipmentItem.model}
                            <span>•</span>
                            <span>{equipmentItem.make} {equipmentItem.model}</span>
                          {/if}
                          {#if equipmentItem.year}
                            <span>•</span>
                            <span>{equipmentItem.year}</span>
                          {/if}
                        </div>
                        <div class="flex items-center space-x-4 text-xs lg:text-sm text-gray-500 dark:text-gray-400 mt-1">
                          <span>Current usage: {equipmentItem.current_usage_value} {equipmentItem.usage_unit}</span>
                          {#if equipmentItem.purchase_date}
                            <span>•</span>
                            <span>Purchased: {formatDate(equipmentItem.purchase_date)}</span>
                          {/if}
                        </div>
                        {#if equipmentItem.serial_number}
                          <p class="text-xs lg:text-sm text-gray-500 dark:text-gray-400 mt-1">Serial: {equipmentItem.serial_number}</p>
                        {/if}
                        {#if equipmentItem.tags}
                          {@const tags = parseTags(equipmentItem.tags)}
                          {#if tags.length > 0}
                            <div class="flex flex-wrap gap-1 mt-2">
                              {#each tags as tag}
                                <span class="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-200">
                                  {tag}
                                </span>
                              {/each}
                            </div>
                          {/if}
                        {/if}
                      </div>
                    </div>
                  </div>
                </div>
                <div class="flex items-center space-x-2 ml-auto">
                  <a 
                    href="/equipment/{equipmentItem.id}/history"
                    class="bg-green-600 hover:bg-green-700 dark:bg-green-700 dark:hover:bg-green-600 text-white px-3 py-1 rounded text-sm font-medium transition-colors"
                  >
                    View History
                  </a>
                  <button 
                    class="bg-blue-600 hover:bg-blue-700 dark:bg-blue-700 dark:hover:bg-blue-600 text-white px-3 py-1 rounded text-sm font-medium transition-colors"
                    on:click={() => openEditModal(equipmentItem)}
                  >
                    Edit
                  </button>
                  <button 
                    class="bg-red-600 hover:bg-red-700 dark:bg-red-700 dark:hover:bg-red-600 text-white px-3 py-1 rounded text-sm font-medium transition-colors"
                    on:click={() => openDeleteModal(equipmentItem)}
                  >
                    Delete
                  </button>
                </div>
              </div>
            </li>
          {/each}
        </ul>
      </div>
    {/if}
  </main>
</div>

<EditEquipmentModal 
  isOpen={showEditModal}
  equipment={selectedEquipment}
  {equipmentTypes}
  equipmentUpdated={handleEquipmentUpdated}
  onCloseModal={() => {
    showEditModal = false;
    selectedEquipment = null;
  }}
/>

<DeleteConfirmationModal 
  isOpen={showDeleteModal}
  title="Delete Equipment"
  message="Are you sure you want to delete this equipment? This action cannot be undone and will also delete all associated maintenance tasks."
  onConfirm={handleDeleteConfirm}
  onCancel={() => {
    showDeleteModal = false;
    selectedEquipment = null;
  }}
/> 