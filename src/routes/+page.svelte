<script lang="ts">
  import { onMount } from 'svelte';
  import type { DashboardStats, Task, Equipment, TaskType, MaintenanceLog, EquipmentType, GlobalSettingsValues } from '$lib/types/db.js';
  import AddEquipmentModal from '$lib/components/AddEquipmentModal.svelte';
  import AddTaskModal from '$lib/components/AddTaskModal.svelte';
  import CompleteTaskModal from '$lib/components/CompleteTaskModal.svelte';
  import QuickAddModal from '$lib/components/QuickAddModal.svelte';
  
  let stats: DashboardStats | null = $state(null);
  let upcomingTasks: Task[] = $state([]);
  let equipment: Equipment[] = $state([]);
  let equipmentTypes: EquipmentType[] = $state([]);
  let taskTypes: TaskType[] = $state([]);
  let loading = $state(true);
  let error = $state('');
  let viewMode: 'list' | 'calendar' = $state('list');
  let settings: GlobalSettingsValues | null = $state(null);
  let settingsError: string = '';
  
  // Calendar state
  let currentDate = $state(new Date());
  let calendarDays: Date[] = $state([]);
  
  // Modal states
  let showAddEquipmentModal = $state(false);
  let showAddTaskModal = $state(false);
  let showCompleteTaskModal = $state(false);
  let showQuickAddModal = $state(false);
  let selectedTask: Task | null = $state(null);
  let showDropdown = $state(false);
  
  const priorityColors = {
    low: 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-200',
    medium: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-200',
    high: 'bg-orange-100 text-orange-800 dark:bg-orange-900/30 dark:text-orange-200',
    critical: 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-200'
  };

  // Calendar utility functions
  function getDaysInMonth(year: number, month: number): number {
    return new Date(year, month + 1, 0).getDate();
  }
  
  function getFirstDayOfMonth(year: number, month: number): number {
    return new Date(year, month, 1).getDay();
  }
  
  function generateCalendarDays(date: Date): Date[] {
    const year = date.getFullYear();
    const month = date.getMonth();
    const daysInMonth = getDaysInMonth(year, month);
    const firstDayOfMonth = getFirstDayOfMonth(year, month);
    
    const days: Date[] = [];
    
    // Add days from previous month to fill first week
    const prevMonth = month === 0 ? 11 : month - 1;
    const prevYear = month === 0 ? year - 1 : year;
    const daysInPrevMonth = getDaysInMonth(prevYear, prevMonth);
    
    for (let i = firstDayOfMonth - 1; i >= 0; i--) {
      days.push(new Date(prevYear, prevMonth, daysInPrevMonth - i));
    }
    
    // Add days of current month
    for (let day = 1; day <= daysInMonth; day++) {
      days.push(new Date(year, month, day));
    }
    
    // Add days from next month to fill last week
    const nextMonth = month === 11 ? 0 : month + 1;
    const nextYear = month === 11 ? year + 1 : year;
    const remainingDays = 42 - days.length; // 6 weeks * 7 days
    
    for (let day = 1; day <= remainingDays; day++) {
      days.push(new Date(nextYear, nextMonth, day));
    }
    
    return days;
  }
  
  function formatDate(date: Date | null): string {
    if (!date) return 'No date set';
    return date.toLocaleDateString('en-US', { 
      month: 'short', 
      day: 'numeric' 
    });
  }
  
  function isSameDay(date1: Date, date2: Date): boolean {
    return date1.getFullYear() === date2.getFullYear() &&
           date1.getMonth() === date2.getMonth() &&
           date1.getDate() === date2.getDate();
  }
  
  function isToday(date: Date): boolean {
    return isSameDay(date, new Date());
  }
  
  function isCurrentMonth(date: Date): boolean {
    return date.getMonth() === currentDate.getMonth() &&
           date.getFullYear() === currentDate.getFullYear();
  }
  
  function getTasksForDate(date: Date): Task[] {
    return upcomingTasks.filter(task => {
      if (!task.next_due_date) return false;
      const taskDate = new Date(task.next_due_date);
      return isSameDay(taskDate, date);
    });
  }
  
  function getDayClass(date: Date): string {
    const baseClass = 'h-24 border hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors';
    const isCurrentDay = isToday(date);
    const isCurrentMonthDay = isCurrentMonth(date);
    const tasks = getTasksForDate(date);
    const overdueTasks = tasks.filter(task => {
      if (!task.next_due_date) return false;
      return new Date(task.next_due_date) < new Date();
    });
    
    if (!isCurrentMonthDay) {
      return `${baseClass} bg-gray-100 dark:bg-gray-900 text-gray-400 dark:text-gray-500 border-gray-200 dark:border-gray-700`;
    }
    
    if (isCurrentDay) {
      return `${baseClass} bg-blue-100 dark:bg-blue-900/30 border-blue-400 dark:border-blue-500`;
    }
    
    if (overdueTasks.length > 0) {
      return `${baseClass} bg-red-50 dark:bg-red-900/20 border-red-300 dark:border-red-600`;
    }
    
    if (tasks.length > 0) {
      return `${baseClass} bg-yellow-50 dark:bg-yellow-900/20 border-yellow-300 dark:border-yellow-600`;
    }
    
    return `${baseClass} border-gray-200 dark:border-gray-700`;
  }
  
  function previousMonth() {
    currentDate = new Date(currentDate.getFullYear(), currentDate.getMonth() - 1, 1);
    calendarDays = generateCalendarDays(currentDate);
  }
  
  function nextMonth() {
    currentDate = new Date(currentDate.getFullYear(), currentDate.getMonth() + 1, 1);
    calendarDays = generateCalendarDays(currentDate);
  }
  
  function openCompleteTaskModal(task: Task) {
    selectedTask = task;
    showCompleteTaskModal = true;
  }
  
  async function loadData() {
    try {
      loading = true;
      const [statsRes, tasksRes, equipmentRes, taskTypesRes, equipmentTypesRes] = await Promise.all([
        fetch('/api/dashboard'),
        fetch('/api/tasks?type=upcoming'),
        fetch('/api/equipment'),
        fetch('/api/task-types'),
        fetch('/api/equipment-types')
      ]);
      
      if (!statsRes.ok || !tasksRes.ok || !equipmentRes.ok || !taskTypesRes.ok || !equipmentTypesRes.ok) {
        throw new Error('Failed to load data');
      }
      
      stats = await statsRes.json();
      upcomingTasks = await tasksRes.json();
      equipment = await equipmentRes.json();
      taskTypes = await taskTypesRes.json();
      equipmentTypes = await equipmentTypesRes.json();
    } catch (err) {
      error = 'Failed to load dashboard data';
      console.error(err);
    } finally {
      loading = false;
    }
  }
  
  function getEquipmentName(equipmentId: number): string {
    return equipment.find(e => e.id === equipmentId)?.name || 'Unknown Equipment';
  }
  
  function getTaskTypeName(taskTypeId: number): string {
    return taskTypes.find(t => t.id === taskTypeId)?.name || 'Unknown Task';
  }

  function getEquipmentTypeName(equipmentTypeId: number): string {
    return equipmentTypes.find(e => e.id === equipmentTypeId)?.name || 'Unknown Equipment'
  }
  
  function getDaysUntilDue(dateString: string | null): number {
    if (!dateString) return 0;
    const dueDate = new Date(dateString);
    const today = new Date();
    const diffTime = dueDate.getTime() - today.getTime();
    return Math.ceil(diffTime / (1000 * 60 * 60 * 24));
  }
  
  function handleEquipmentCreated(event: CustomEvent) {
    const newEquipment = event.detail;
    equipment = [...equipment, newEquipment];
    loadData();
  }
  
  function handleTaskCreated(event: CustomEvent) {
    const newTask = event.detail;
    upcomingTasks = [...upcomingTasks, newTask];
    loadData();
  }
  
  function handleTaskCompleted(result: { updated_task: Task, maintenance_log: MaintenanceLog, message: string }) {
    upcomingTasks = upcomingTasks.filter(task => task.id !== result.updated_task.id);
    loadData();
  }
  
  function handleClickOutside(event: MouseEvent) {
    const target = event.target as HTMLElement;
    if (!target.closest('.split-button-container')) {
      showDropdown = false;
    }
  }

  async function loadSettings() {
    try {
      loading = true;
      settingsError = '';
      
      const response = await fetch('/api/settings');
      if (!response.ok) {
        throw new Error('Failed to load settings');
      }
      
      settings = await response.json();
    } catch (err) {
      settingsError = 'Failed to load settings';
      console.error(err);
    } finally {
      loading = false;
    }
  }
  
  onMount(() => {
    loadSettings()
    loadData();
    calendarDays = generateCalendarDays(currentDate);
    
    document.addEventListener('click', handleClickOutside);
    
    return () => {
      document.removeEventListener('click', handleClickOutside);
    };
  });
</script>

{#snippet taskIcon(taskTypeId: number)}
  {#if taskTypeId === 1}
    <svg xmlns="http://www.w3.org/2000/svg" class="h-6 w-6 text-gray-600 dark:text-gray-300" fill="currentColor" viewBox="0 0 256 256"><path d="M230.6,49.53A15.81,15.81,0,0,0,216,40H40A16,16,0,0,0,28.19,66.76l.08.09L96,139.17V216a16,16,0,0,0,24.87,13.32l32-21.34A16,16,0,0,0,160,194.66V139.17l67.74-72.32.08-.09A15.8,15.8,0,0,0,230.6,49.53ZM40,56h0Zm106.18,74.58A8,8,0,0,0,144,136v58.66L112,216V136a8,8,0,0,0-2.16-5.47L40,56H216Z"></path></svg>
  {:else if taskTypeId === 2 || taskTypeId === 11}
  <svg xmlns="http://www.w3.org/2000/svg" class="h-6 w-6 text-gray-600 dark:text-gray-300" fill="currentColor" viewBox="0 0 256 256"><path d="M224,48V152a16,16,0,0,1-16,16H99.31l10.35,10.34a8,8,0,0,1-11.32,11.32l-24-24a8,8,0,0,1,0-11.32l24-24a8,8,0,0,1,11.32,11.32L99.31,152H208V48H96v8a8,8,0,0,1-16,0V48A16,16,0,0,1,96,32H208A16,16,0,0,1,224,48ZM168,192a8,8,0,0,0-8,8v8H48V104H156.69l-10.35,10.34a8,8,0,0,0,11.32,11.32l24-24a8,8,0,0,0,0-11.32l-24-24a8,8,0,0,0-11.32,11.32L156.69,88H48a16,16,0,0,0-16,16V208a16,16,0,0,0,16,16H160a16,16,0,0,0,16-16v-8A8,8,0,0,0,168,192Z"></path></svg>
  {:else if taskTypeId === 3}
    <svg xmlns="http://www.w3.org/2000/svg" class="h-6 w-6 text-gray-600 dark:text-gray-300" fill="currentColor" viewBox="0 0 256 256"><path d="M229.66,218.34l-50.07-50.06a88.11,88.11,0,1,0-11.31,11.31l50.06,50.07a8,8,0,0,0,11.32-11.32ZM40,112a72,72,0,1,1,72,72A72.08,72.08,0,0,1,40,112Z"></path></svg>
  {:else if taskTypeId === 4}
    <svg xmlns="http://www.w3.org/2000/svg" class="h-6 w-6 text-gray-600 dark:text-gray-300" fill="currentColor" viewBox="0 0 256 256"><path d="M235.5,216.81c-22.56-11-35.5-34.58-35.5-64.8V134.73a15.94,15.94,0,0,0-10.09-14.87L165,110a8,8,0,0,1-4.48-10.34l21.32-53a28,28,0,0,0-16.1-37,28.14,28.14,0,0,0-35.82,16,.61.61,0,0,0,0,.12L108.9,79a8,8,0,0,1-10.37,4.49L73.11,73.14A15.89,15.89,0,0,0,55.74,76.8C34.68,98.45,24,123.75,24,152a111.45,111.45,0,0,0,31.18,77.53A8,8,0,0,0,61,232H232a8,8,0,0,0,3.5-15.19ZM67.14,88l25.41,10.3a24,24,0,0,0,31.23-13.45l21-53c2.56-6.11,9.47-9.27,15.43-7a12,12,0,0,1,6.88,15.92L145.69,93.76a24,24,0,0,0,13.43,31.14L184,134.73V152c0,.33,0,.66,0,1L55.77,101.71A108.84,108.84,0,0,1,67.14,88Zm48,128a87.53,87.53,0,0,1-24.34-42,8,8,0,0,0-15.49,4,105.16,105.16,0,0,0,18.36,38H64.44A95.54,95.54,0,0,1,40,152a85.9,85.9,0,0,1,7.73-36.29l137.8,55.12c3,18,10.56,33.48,21.89,45.16Z"></path></svg>
  {:else if taskTypeId === 5}
    <svg xmlns="http://www.w3.org/2000/svg" class="h-6 w-6 text-gray-600 dark:text-gray-300" fill="currentColor" viewBox="0 0 256 256"><path d="M174,47.75a254.19,254.19,0,0,0-41.45-38.3,8,8,0,0,0-9.18,0A254.19,254.19,0,0,0,82,47.75C54.51,79.32,40,112.6,40,144a88,88,0,0,0,176,0C216,112.6,201.49,79.32,174,47.75ZM128,216a72.08,72.08,0,0,1-72-72c0-57.23,55.47-105,72-118,16.53,13,72,60.75,72,118A72.08,72.08,0,0,1,128,216Zm55.89-62.66a57.6,57.6,0,0,1-46.56,46.55A8.75,8.75,0,0,1,136,200a8,8,0,0,1-1.32-15.89c16.57-2.79,30.63-16.85,33.44-33.45a8,8,0,0,1,15.78,2.68Z"></path></svg>
  {:else if taskTypeId === 7}
    <svg xmlns="http://www.w3.org/2000/svg" class="h-6 w-6 text-gray-600 dark:text-gray-300" fill="currentColor" viewBox="0 0 256 256"><path d="M128,80a48,48,0,1,0,48,48A48.06,48.06,0,0,0,128,80Zm0,80a32,32,0,1,1,32-32A32,32,0,0,1,128,160Zm95.68-93.85L135.68,18a15.88,15.88,0,0,0-15.36,0l-88,48.17a16,16,0,0,0-8.32,14v95.64a16,16,0,0,0,8.32,14l88,48.17a15.88,15.88,0,0,0,15.36,0l88-48.17h0a16,16,0,0,0,8.32-14V80.18A16,16,0,0,0,223.68,66.15ZM128,224,40,175.82V80.18L128,32l88,48.17v95.64Z"></path></svg>
  {:else if taskTypeId === 8}
    <svg xmlns="http://www.w3.org/2000/svg" class="h-6 w-6 text-gray-600 dark:text-gray-300" fill="currentColor" viewBox="0 0 256 256"><path d="M136,40V216a8,8,0,0,1-16,0V40a8,8,0,0,1,16,0ZM69.66,90.34a8,8,0,0,0-11.32,11.32L76.69,120H16a8,8,0,0,0,0,16H76.69L58.34,154.34a8,8,0,0,0,11.32,11.32l32-32a8,8,0,0,0,0-11.32ZM240,120H179.31l18.35-18.34a8,8,0,0,0-11.32-11.32l-32,32a8,8,0,0,0,0,11.32l32,32a8,8,0,0,0,11.32-11.32L179.31,136H240a8,8,0,0,0,0-16Z"></path></svg>
  {:else if taskTypeId === 9}
    <svg xmlns="http://www.w3.org/2000/svg" class="h-6 w-6 text-gray-600 dark:text-gray-300" fill="currentColor" viewBox="0 0 256 256"><path d="M192,136a8,8,0,0,1-8,8h-8v8a8,8,0,0,1-16,0v-8h-8a8,8,0,0,1,0-16h8v-8a8,8,0,0,1,16,0v8h8A8,8,0,0,1,192,136Zm-88-8H72a8,8,0,0,0,0,16h32a8,8,0,0,0,0-16ZM240,88v96a16,16,0,0,1-16,16H32a16,16,0,0,1-16-16V88A16,16,0,0,1,32,72H48V56A16,16,0,0,1,64,40H96a16,16,0,0,1,16,16V72h32V56a16,16,0,0,1,16-16h32a16,16,0,0,1,16,16V72h16A16,16,0,0,1,240,88ZM160,72h32V56H160ZM64,72H96V56H64ZM224,184V88H32v96H224Z"></path></svg>
  {:else if taskTypeId === 10}
    <svg xmlns="http://www.w3.org/2000/svg" class="h-6 w-6 text-gray-600 dark:text-gray-300" fill="currentColor" viewBox="0 0 256 256"><path d="M224,48V96a8,8,0,0,1-8,8H168a8,8,0,0,1,0-16h28.69L182.06,73.37a79.56,79.56,0,0,0-56.13-23.43h-.45A79.52,79.52,0,0,0,69.59,72.71,8,8,0,0,1,58.41,61.27a96,96,0,0,1,135,.79L208,76.69V48a8,8,0,0,1,16,0ZM186.41,183.29a80,80,0,0,1-112.47-.66L59.31,168H88a8,8,0,0,0,0-16H40a8,8,0,0,0-8,8v48a8,8,0,0,0,16,0V179.31l14.63,14.63A95.43,95.43,0,0,0,130,222.06h.53a95.36,95.36,0,0,0,67.07-27.33,8,8,0,0,0-11.18-11.44Z"></path></svg>
  {:else if taskTypeId === 12}
    <svg xmlns="http://www.w3.org/2000/svg" class="h-6 w-6 text-gray-600 dark:text-gray-300" fill="currentColor" viewBox="0 0 256 256"><path d="M240,184h-8V57.9l9.67-2.08a8,8,0,1,0-3.35-15.64l-224,48A8,8,0,0,0,16,104a8.16,8.16,0,0,0,1.69-.18L24,102.47V184H16a8,8,0,0,0,0,16H240a8,8,0,0,0,0-16ZM40,99,216,61.33V184H192V128a8,8,0,0,0-8-8H72a8,8,0,0,0-8,8v56H40Zm136,53H80V136h96ZM80,168h96v16H80Z"></path></svg>
  {:else}
    <svg class="h-6 w-6 text-gray-600 dark:text-gray-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z"></path>
      <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"></path>
    </svg>
  {/if}
{/snippet}

<svelte:head>
  <title>Mechmate - Maintenance Dashboard</title>
</svelte:head>

<div class="min-h-screen bg-gray-50 dark:bg-gray-900 px-4 sm:px-6 lg:px-8 py-8">
  <!-- Header -->
  <header class="max-w-7xl lg:mx-auto bg-white dark:bg-gray-800 shadow-sm border-gray-200 dark:border-gray-700 mb-4 rounded-lg">
    <div class="px-4 sm:px-6 lg:px-8">
      <div class="flex justify-between items-center py-4 space-x-4">
        <div class="flex items-center gap-4">
          <img src="/robot.png" alt="mechmate" class="h-10 w-10"/>
          <h1 class="text-xl lg:text-2xl font-bold text-gray-900 dark:text-white">Mechmate</h1>
        </div>
        <div class="flex items-center space-x-2 lg:space-x-4">
          <a 
            href="/settings" 
            class="p-2 text-gray-600 hover:text-gray-900 dark:text-gray-300 dark:hover:text-white transition-colors"
            aria-label="Settings"
          >
            <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" fill="currentColor" viewBox="0 0 256 256">
              <path d="M128,80a48,48,0,1,0,48,48A48.05,48.05,0,0,0,128,80Zm0,80a32,32,0,1,1,32-32A32,32,0,0,1,128,160Zm88-29.84q.06-2.16,0-4.32l14.92-18.64a8,8,0,0,0,1.48-7.06,107.21,107.21,0,0,0-10.88-26.25,8,8,0,0,0-6-3.93l-23.72-2.64q-1.48-1.56-3-3L186,40.54a8,8,0,0,0-3.94-6,107.71,107.71,0,0,0-26.25-10.87,8,8,0,0,0-7.06,1.49L130.16,40Q128,40,125.84,40L107.2,25.11a8,8,0,0,0-7.06-1.48A107.6,107.6,0,0,0,73.89,34.51a8,8,0,0,0-3.93,6L67.32,64.27q-1.56,1.49-3,3L40.54,70a8,8,0,0,0-6,3.94,107.71,107.71,0,0,0-10.87,26.25,8,8,0,0,0,1.49,7.06L40,125.84Q40,128,40,130.16L25.11,148.8a8,8,0,0,0-1.48,7.06,107.21,107.21,0,0,0,10.88,26.25,8,8,0,0,0,6,3.93l23.72,2.64q1.49,1.56,3,3L70,215.46a8,8,0,0,0,3.94,6,107.71,107.71,0,0,0,26.25,10.87,8,8,0,0,0,7.06-1.49L125.84,216q2.16.06,4.32,0l18.64,14.92a8,8,0,0,0,7.06,1.48,107.21,107.21,0,0,0,26.25-10.88,8,8,0,0,0,3.93-6l2.64-23.72q1.56-1.48,3-3L215.46,186a8,8,0,0,0,6-3.94,107.71,107.71,0,0,0,10.87-26.25,8,8,0,0,0-1.49-7.06Zm-16.1-6.5a73.93,73.93,0,0,1,0,8.68,8,8,0,0,0,1.74,5.48l14.19,17.73a91.57,91.57,0,0,1-6.23,15L187,173.11a8,8,0,0,0-5.1,2.64,74.11,74.11,0,0,1-6.14,6.14,8,8,0,0,0-2.64,5.1l-2.51,22.58a91.32,91.32,0,0,1-15,6.23l-17.74-14.19a8,8,0,0,0-5-1.75h-.48a73.93,73.93,0,0,1-8.68,0,8,8,0,0,0-5.48,1.74L100.45,215.8a91.57,91.57,0,0,1-15-6.23L82.89,187a8,8,0,0,0-2.64-5.1,74.11,74.11,0,0,1-6.14-6.14,8,8,0,0,0-5.1-2.64L46.43,170.6a91.32,91.32,0,0,1-6.23-15l14.19-17.74a8,8,0,0,0,1.74-5.48,73.93,73.93,0,0,1,0-8.68,8,8,0,0,0-1.74-5.48L40.2,100.45a91.57,91.57,0,0,1,6.23-15L69,82.89a8,8,0,0,0,5.1-2.64,74.11,74.11,0,0,1,6.14-6.14A8,8,0,0,0,82.89,69L85.4,46.43a91.32,91.32,0,0,1,15-6.23l17.74,14.19a8,8,0,0,0,5.48,1.74,73.93,73.93,0,0,1,8.68,0,8,8,0,0,0,5.48-1.74L155.55,40.2a91.57,91.57,0,0,1,15,6.23L173.11,69a8,8,0,0,0,2.64,5.1,74.11,74.11,0,0,1,6.14,6.14,8,8,0,0,0,5.1,2.64l22.58,2.51a91.32,91.32,0,0,1,6.23,15l-14.19,17.74A8,8,0,0,0,199.87,123.66Z"></path>
            </svg>
          </a>
          
          <div class="relative inline-flex rounded-lg shadow-sm split-button-container">
            <!-- Main button -->
            <button 
              class="bg-blue-600 hover:bg-blue-700 dark:bg-blue-700 dark:hover:bg-blue-600 text-white px-4 py-2 rounded-l-lg font-medium transition-colors text-sm lg:text-base whitespace-nowrap border-r border-blue-500 dark:border-blue-600 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 dark:focus:ring-offset-gray-800"
              disabled={!stats}
              onclick={() => {
                showQuickAddModal = true;
              }}
            >
              Quick Edit
            </button>
            <!-- Dropdown toggle -->
            <button 
              class="bg-blue-600 hover:bg-blue-700 dark:bg-blue-700 dark:hover:bg-blue-600 text-white px-2 py-2 rounded-r-lg font-medium transition-colors text-sm lg:text-base border-l border-blue-500 dark:border-blue-600 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 dark:focus:ring-offset-gray-800"
              disabled={!stats}
              onclick={() => showDropdown = !showDropdown}
              aria-label="Open menu"
              aria-expanded={showDropdown}
              aria-haspopup="true"
            >
              <svg class="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                <path fill-rule="evenodd" d="M5.293 7.293a1 1 0 011.414 0L10 10.586l3.293-3.293a1 1 0 111.414 1.414l-4 4a1 1 0 01-1.414 0l-4-4a1 1 0 010-1.414z" clip-rule="evenodd" />
              </svg>
            </button>
            
            <!-- Dropdown menu -->
            {#if showDropdown}
              <div class="absolute right-0 top-[110%] mt-1 w-48 bg-white dark:bg-gray-800 rounded-lg shadow-lg border border-gray-200 dark:border-gray-700 z-10">
                <div class="">
                  <button 
                    class="w-full text-left px-6 py-4 text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors flex items-center gap-2 disabled:opacity-25"
                    disabled={stats?.total_equipment === 0}
                    onclick={() => {
                      showAddTaskModal = true
                      showDropdown = false
                    }}
                  >
  
                      Add Task
                  </button>
                </div>
                <div class="">
                  <button 
                    class="w-full text-left px-6 py-4 text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors flex items-center gap-2 disabled:opacity-25"
                    disabled={stats?.total_equipment === 0}
                    onclick={() => {
                      showAddEquipmentModal = true
                      showDropdown = false
                    }}
                  >
                      Add Equipment
                  </button>
                </div>
              </div>
            {/if}
          </div>
        </div>
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
        <button onclick={loadData} class="mt-2 text-red-600 dark:text-red-400 hover:text-red-800 dark:hover:text-red-200 underline">
          Try again
        </button>
      </div>
    {:else}
      <!-- Stats Section -->
      {#if stats}
        <div class="grid grid-cols-2 md:grid-cols-4 gap-2 md:gap-6 mb-8 auto-rows-[1fr]">
          <div class="bg-white dark:bg-gray-800 rounded-lg shadow dark:shadow-gray-900/20 p-4 md:p-6">
            <div class="flex h-full items-center gap-4">
              <div class="p-2 bg-green-100 dark:bg-green-900/30 rounded-lg">
                <svg xmlns="http://www.w3.org/2000/svg" class="w-6 h-6 text-green-600 dark:text-green-400" fill="currentColor" stroke="currentColor" viewBox="0 0 256 256"><path d="M200,32H163.74a47.92,47.92,0,0,0-71.48,0H56A16,16,0,0,0,40,48V216a16,16,0,0,0,16,16H200a16,16,0,0,0,16-16V48A16,16,0,0,0,200,32Zm-72,0a32,32,0,0,1,32,32H96A32,32,0,0,1,128,32Zm72,184H56V48H82.75A47.93,47.93,0,0,0,80,64v8a8,8,0,0,0,8,8h80a8,8,0,0,0,8-8V64a47.93,47.93,0,0,0-2.75-16H200Z"></path></svg>
              </div>
              <div>
                <p class="text-sm font-medium text-gray-600 dark:text-gray-300">Upcoming</p>
                <p class="text-2xl font-bold text-gray-900 dark:text-white">{stats.upcoming_jobs}</p>
              </div>
            </div>
          </div>

          <div class="bg-white dark:bg-gray-800 rounded-lg shadow dark:shadow-gray-900/20 p-4 md:p-6">
            <div class="flex h-full items-center gap-4">
              <div class="p-2 bg-red-100 dark:bg-red-900/30 rounded-lg">
                <svg xmlns="http://www.w3.org/2000/svg" class="w-6 h-6 text-red-600 dark:text-red-400" fill="currentColor" viewBox="0 0 256 256"><path d="M236.8,188.09,149.35,36.22h0a24.76,24.76,0,0,0-42.7,0L19.2,188.09a23.51,23.51,0,0,0,0,23.72A24.35,24.35,0,0,0,40.55,224h174.9a24.35,24.35,0,0,0,21.33-12.19A23.51,23.51,0,0,0,236.8,188.09ZM222.93,203.8a8.5,8.5,0,0,1-7.48,4.2H40.55a8.5,8.5,0,0,1-7.48-4.2,7.59,7.59,0,0,1,0-7.72L120.52,44.21a8.75,8.75,0,0,1,15,0l87.45,151.87A7.59,7.59,0,0,1,222.93,203.8ZM120,144V104a8,8,0,0,1,16,0v40a8,8,0,0,1-16,0Zm20,36a12,12,0,1,1-12-12A12,12,0,0,1,140,180Z"></path></svg>
              </div>
              <div>
                <p class="text-sm font-medium text-gray-600 dark:text-gray-300">Overdue</p>
                <p class="text-2xl font-bold text-gray-900 dark:text-white">{stats.overdue_jobs}</p>
              </div>
            </div>
          </div>

          <div class="bg-white dark:bg-gray-800 rounded-lg shadow dark:shadow-gray-900/20 p-4 md:p-6">
            <div class="flex h-full items-center gap-4">
              <div class="p-2 bg-blue-100 dark:bg-blue-900/30 rounded-lg">
                <svg xmlns="http://www.w3.org/2000/svg" class="w-6 h-6 text-blue-600 dark:text-blue-400" fill="currentColor" viewBox="0 0 256 256"><path d="M240,192h-8V98.67a16,16,0,0,0-7.12-13.31l-88-58.67a16,16,0,0,0-17.75,0l-88,58.67A16,16,0,0,0,24,98.67V192H16a8,8,0,0,0,0,16H240a8,8,0,0,0,0-16ZM40,98.67,128,40l88,58.66V192H192V136a8,8,0,0,0-8-8H72a8,8,0,0,0-8,8v56H40ZM176,144v16H136V144Zm-56,16H80V144h40ZM80,176h40v16H80Zm56,0h40v16H136Z"></path></svg>
              </div>
              <div>
                <p class="text-sm font-medium text-gray-600 dark:text-gray-300">Equipment</p>
                <p class="text-2xl font-bold text-gray-900 dark:text-white">{stats.total_equipment}</p>
              </div>
              <div class="ml-auto h-full">
                <a href="/equipment" class="text-blue-600 hover:text-blue-800 dark:text-blue-400 dark:hover:text-blue-300" aria-label="Edit equipment">
                  <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" fill="currentColor" viewBox="0 0 256 256"><path d="M221.66,133.66l-72,72a8,8,0,0,1-11.32-11.32L196.69,136H40a8,8,0,0,1,0-16H196.69L138.34,61.66a8,8,0,0,1,11.32-11.32l72,72A8,8,0,0,1,221.66,133.66Z"></path></svg>
                </a>
              </div>
            </div>
          </div>
          
          <div class="bg-white dark:bg-gray-800 rounded-lg shadow dark:shadow-gray-900/20 p-4 md:p-6">
            <div class="flex h-full items-center gap-4">
              <div class="p-2 bg-purple-100 dark:bg-purple-900/30 rounded-lg">
                <svg xmlns="http://www.w3.org/2000/svg" class="w-6 h-6 text-purple-600 dark:text-purple-400"  fill="currentColor" viewBox="0 0 256 256"><path d="M173.66,98.34a8,8,0,0,1,0,11.32l-56,56a8,8,0,0,1-11.32,0l-24-24a8,8,0,0,1,11.32-11.32L112,148.69l50.34-50.35A8,8,0,0,1,173.66,98.34ZM232,128A104,104,0,1,1,128,24,104.11,104.11,0,0,1,232,128Zm-16,0a88,88,0,1,0-88,88A88.1,88.1,0,0,0,216,128Z"></path></svg>
              </div>
              <div>
                <p class="text-sm font-medium text-gray-600 dark:text-gray-300">Tasks</p>
                <p class="text-2xl font-bold text-gray-900 dark:text-white">{stats.total_tasks}</p>
              </div>
              <div class="ml-auto h-full">
                <a href="/tasks" class="text-blue-600 hover:text-blue-800 dark:text-blue-400 dark:hover:text-blue-300" aria-label="Edit tasks">
                  <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" fill="currentColor" viewBox="0 0 256 256"><path d="M221.66,133.66l-72,72a8,8,0,0,1-11.32-11.32L196.69,136H40a8,8,0,0,1,0-16H196.69L138.34,61.66a8,8,0,0,1,11.32-11.32l72,72A8,8,0,0,1,221.66,133.66Z"></path></svg>
                </a>
              </div>
            </div>
          </div>
        </div>
      {/if}

      <!-- View Mode Toggle -->
      <div class="flex justify-between items-center mb-6">
        <div class="flex items-center gap-3 items-center">
          <h2 class="text-xl lg:text-2xl font-bold text-gray-900 dark:text-white">Upcoming Tasks</h2>
          {#if settings?.upcoming_task_range_days}
            <p class="text-sm text-gray-400 translate-y-0.5">{settings.upcoming_task_range_days} days</p>
          {/if}
        </div>
        <div class="flex bg-gray-100 dark:bg-gray-700 rounded-lg p-1">
          <button 
            aria-label="List view"
            class="px-4 py-2 rounded-md text-sm font-medium transition-colors whitespace-nowrap {viewMode === 'list' ? 'bg-white dark:bg-gray-600 text-gray-900 dark:text-white shadow-sm' : 'text-gray-600 dark:text-gray-300 hover:text-gray-900 dark:hover:text-white'}"
            onclick={() => viewMode = 'list'}
          >
          <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" fill="currentColor" viewBox="0 0 256 256"><path d="M224,128a8,8,0,0,1-8,8H128a8,8,0,0,1,0-16h88A8,8,0,0,1,224,128ZM128,72h88a8,8,0,0,0,0-16H128a8,8,0,0,0,0,16Zm88,112H128a8,8,0,0,0,0,16h88a8,8,0,0,0,0-16ZM82.34,42.34,56,68.69,45.66,58.34A8,8,0,0,0,34.34,69.66l16,16a8,8,0,0,0,11.32,0l32-32A8,8,0,0,0,82.34,42.34Zm0,64L56,132.69,45.66,122.34a8,8,0,0,0-11.32,11.32l16,16a8,8,0,0,0,11.32,0l32-32a8,8,0,0,0-11.32-11.32Zm0,64L56,196.69,45.66,186.34a8,8,0,0,0-11.32,11.32l16,16a8,8,0,0,0,11.32,0l32-32a8,8,0,0,0-11.32-11.32Z"></path></svg>
          </button>
          <button 
            aria-label="Calendar view"
            class="px-4 py-2 rounded-md text-sm font-medium transition-colors whitespace-nowrap {viewMode === 'calendar' ? 'bg-white dark:bg-gray-600 text-gray-900 dark:text-white shadow-sm' : 'text-gray-600 dark:text-gray-300 hover:text-gray-900 dark:hover:text-white'}"
            onclick={() => viewMode = 'calendar'}
          >
          <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" fill="currentColor" viewBox="0 0 256 256"><path d="M208,32H184V24a8,8,0,0,0-16,0v8H88V24a8,8,0,0,0-16,0v8H48A16,16,0,0,0,32,48V208a16,16,0,0,0,16,16H208a16,16,0,0,0,16-16V48A16,16,0,0,0,208,32ZM72,48v8a8,8,0,0,0,16,0V48h80v8a8,8,0,0,0,16,0V48h24V80H48V48ZM208,208H48V96H208V208Zm-68-76a12,12,0,1,1-12-12A12,12,0,0,1,140,132Zm44,0a12,12,0,1,1-12-12A12,12,0,0,1,184,132ZM96,172a12,12,0,1,1-12-12A12,12,0,0,1,96,172Zm44,0a12,12,0,1,1-12-12A12,12,0,0,1,140,172Zm44,0a12,12,0,1,1-12-12A12,12,0,0,1,184,172Z"></path></svg>
          </button>
        </div>
      </div>

      <!-- Tasks List -->
      {#if viewMode === 'list'}
        {#if upcomingTasks.length === 0}
          <div class="bg-white dark:bg-gray-800 rounded-lg shadow dark:shadow-gray-900/20 p-12 text-center">
            <svg xmlns="http://www.w3.org/2000/svg" class="mx-auto h-12 w-12 text-gray-400 dark:text-gray-500" fill="currentColor" viewBox="0 0 256 256"><path d="M200,32H163.74a47.92,47.92,0,0,0-71.48,0H56A16,16,0,0,0,40,48V216a16,16,0,0,0,16,16H200a16,16,0,0,0,16-16V48A16,16,0,0,0,200,32Zm-72,0a32,32,0,0,1,32,32H96A32,32,0,0,1,128,32Zm72,184H56V48H82.75A47.93,47.93,0,0,0,80,64v8a8,8,0,0,0,8,8h80a8,8,0,0,0,8-8V64a47.93,47.93,0,0,0-2.75-16H200Z"></path></svg>
            <h3 class="mt-2 text-sm font-medium text-gray-900 dark:text-white">No upcoming maintenance</h3>
            {#if stats && stats.total_tasks > 0}
              <p class="mt-1 text-sm text-gray-500 dark:text-gray-400">You're all up to date, relax!</p>
            {:else}
              <p class="mt-1 text-sm text-gray-500 dark:text-gray-400">Get started by adding some equipment and tasks.</p>
              <div class="mt-6 flex flex-col items-center gap-4">
                <button 
                  class="bg-blue-600 hover:bg-blue-700 dark:bg-blue-700 dark:hover:bg-blue-600 text-white px-4 py-2 rounded-lg font-medium transition-colors w-fit"
                  disabled={!stats}
                  onclick={() => showAddEquipmentModal = true}
                >
                  {stats?.total_equipment === 0 ? "Add your first equipment" : "Add more equipment"}
                </button>
                <button 
                  class="bg-green-600 hover:bg-green-700 dark:bg-green-700 dark:hover:bg-green-600 disabled:opacity-25 text-white px-4 py-2 rounded-lg font-medium transition-colors w-fit"
                  onclick={() => showAddTaskModal = true}
                  disabled={!stats || (stats !== null && stats?.total_equipment === 0)}
                >
                  Add your first task
                </button>
              </div>
            {/if}
          </div>
        {:else}
          <div class="bg-white dark:bg-gray-800 shadow dark:shadow-gray-900/20 overflow-hidden rounded-md">
            <ul class="divide-y divide-gray-200 dark:divide-gray-700">
              {#each upcomingTasks as task, i}
                {@const equipmentName = getEquipmentName(task.equipment_id)}
                {@const taskTypeName = getTaskTypeName(task.task_type_id)}
                {@const daysUntilDue = getDaysUntilDue(task.next_due_date || null)}
                {@const isOverdue = daysUntilDue < 0}
                
                <li class="px-6 py-4 transition-colors {isOverdue ? "bg-red-50 dark:bg-red-900/20 border-red-300 dark:border-red-900" : "hover:bg-gray-50 dark:hover:bg-gray-700"}">
                  <div class="flex items-center justify-between flex-wrap gap-y-4">
                    <div class="flex items-center">
                      <div class="flex-shrink-0">
                        <div class="h-10 w-10 rounded-full bg-gray-300 dark:bg-gray-600 flex items-center justify-center">
                          {@render taskIcon(task.task_type_id)}
                        </div>
                      </div>
                      <div class="ml-4">
                        <div class="flex items-center space-x-2">
                          <h3 class="text-lg font-medium text-gray-900 dark:text-white">{task.title}</h3>
                          {#if isOverdue}
                            <span class="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-200">
                              Overdue
                            </span>
                          {/if}
                        </div>
                        <div class="flex gap-2 mt-1 items-start">
                          <span class="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium {priorityColors[task.priority]} capitalize whitespace-nowrap">
                            {task.priority}
                          </span>
                          <p class="text-sm text-gray-600 dark:text-gray-300">{equipmentName} • {taskTypeName}</p>
                        </div>
                        {#if task.description}
                          <p class="text-sm text-gray-500 dark:text-gray-400 mt-1 max-w-2xl">{task.description}</p>
                        {/if}
                      </div>
                    </div>
                    <div class="flex items-center space-x-4 min-w-fit ml-auto">
                      <div class="text-right">
                        <p class="text-sm font-medium text-gray-900 dark:text-white">
                          {#if isOverdue}
                            {Math.abs(daysUntilDue)} days overdue
                          {:else if daysUntilDue === 0}
                            Due today
                          {:else}
                            Due in {daysUntilDue} days
                          {/if}
                        </p>
                        <p class="text-sm text-gray-500 dark:text-gray-400">{task.next_due_date ? formatDate(new Date(task.next_due_date)) : 'No date set'}</p>
                      </div>
                      <button 
                        class="bg-blue-600 hover:bg-blue-700 dark:bg-blue-700 dark:hover:bg-blue-600 text-white px-3 py-1 rounded text-sm font-medium transition-colors"
                        onclick={() => openCompleteTaskModal(task)}
                      >
                        Complete
                      </button>
                    </div>
                  </div>
                </li>
              {/each}
            </ul>
          </div>
        {/if}
      {/if}
      {#if viewMode === 'calendar'}
        <div class="bg-white dark:bg-gray-800 rounded-lg shadow dark:shadow-gray-900/20">
          <!-- Calendar Header -->
          <div class="p-6 border-b border-gray-200 dark:border-gray-700">
            <div class="flex justify-between items-center">
              <h3 class="text-lg font-semibold text-gray-900 dark:text-white">Calendar View</h3>
              <div class="flex space-x-2">
                <button
                  onclick={previousMonth}
                  class="px-3 py-1 text-sm bg-gray-100 hover:bg-gray-200 dark:bg-gray-700 dark:hover:bg-gray-600 dark:text-white rounded transition-colors"
                >
                  ←
                </button>
                <span class="px-4 py-1 text-sm font-medium text-gray-900 dark:text-white">
                  {currentDate.toLocaleDateString('en-US', { month: 'long', year: 'numeric' })}
                </span>
                <button
                  onclick={nextMonth}
                  class="px-3 py-1 text-sm bg-gray-100 hover:bg-gray-200 dark:bg-gray-700 dark:hover:bg-gray-600 dark:text-white rounded transition-colors"
                >
                  →
                </button>
              </div>
            </div>
          </div>

          <!-- Calendar Grid -->
          <div class="p-0 lg:p-6">
            <div class="grid grid-cols-7 gap-0 lg:gap-1">
              <!-- Day headers -->
              {#each ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'] as day}
                <div class="h-8 flex items-center justify-center text-sm font-medium text-gray-500 dark:text-gray-400">
                  {day}
                </div>
              {/each}

              <!-- Calendar days -->
              {#each calendarDays as day (day.toISOString())}
                <div class={getDayClass(day)}>
                  <div class="text-sm font-medium  m-1 mr-0">
                    {day.getDate()}
                  </div>
                  <div class="space-y-1">
                    {#each getTasksForDate(day) as task (task.id)}
                      {@const isOverdue = task.next_due_date && new Date(task.next_due_date) < new Date()}
                      <div 
                        aria-label="Complete task"
                        role="button"
                        tabindex="0"
                        onkeydown={(e) => e.key === 'Enter' && openCompleteTaskModal(task)}
                        class="text-xs p-1 rounded truncate cursor-pointer transition-colors {isOverdue ? 'bg-red-200 text-red-800 dark:bg-red-900/30 dark:text-red-200 hover:bg-red-300 dark:hover:bg-red-900/50' : 'bg-yellow-200 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-200 hover:bg-yellow-300 dark:hover:bg-yellow-900/50'}"
                        onclick={() => openCompleteTaskModal(task)}
                        title="{task.title} - {getEquipmentName(task.equipment_id)}"
                      >
                        {task.title} - {getEquipmentName(task.equipment_id)}
                      </div>
                    {/each}
                  </div>
                </div>
              {/each}
            </div>
          </div>
        </div>
      {/if}
    {/if}
  </main>
</div>

<AddEquipmentModal 
  isOpen={showAddEquipmentModal}
  {equipmentTypes}
  equipmentCreated={handleEquipmentCreated}
  onCloseModal={() => showAddEquipmentModal = false}
/>

<AddTaskModal 
  isOpen={showAddTaskModal} 
  {equipment}
  {taskTypes}
  {equipmentTypes}
  taskCreated={handleTaskCreated}
  onCloseModal={() => showAddTaskModal = false}
/>

<CompleteTaskModal 
  isOpen={showCompleteTaskModal}
  task={selectedTask}
  {equipment}
  taskCompleted={handleTaskCompleted}
  onCloseModal={() => showCompleteTaskModal = false}
/>

<QuickAddModal 
  isOpen={showQuickAddModal}
  {equipment}
  {taskTypes}
  {equipmentTypes}
  onClose={() => showQuickAddModal = false}
/>
