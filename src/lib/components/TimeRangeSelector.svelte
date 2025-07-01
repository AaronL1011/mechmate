<script lang="ts">
  let { onDaysChange, selectedDays = $bindable() }: { onDaysChange: (days: number) => void, selectedDays: number } = $props();

  let selectedRange: string = $state('3months');
  let customDays: number = $state(selectedDays);
  let showCustomInput: boolean = $derived(selectedRange === 'custom');

  $effect(() => {
    if (selectedDays) {
      let newRange = presetRanges.find(range => range.days === selectedDays)?.value || 'custom';
      selectedRange = newRange;
    }
  });

  const presetRanges = [
    { value: '1week', label: '1 Week', days: 7 },
    { value: '3weeks', label: '3 Weeks', days: 21 },
    { value: '1month', label: '1 Month', days: 30 },
    { value: '3months', label: '3 Months', days: 90 },
    { value: 'custom', label: 'Custom', days: 100 }
  ];

  function handleRangeChange() {
    const selectedPreset = presetRanges.find(range => range.value === selectedRange);
    console.log(selectedPreset)
    if (selectedRange === 'custom') {
      onDaysChange(presetRanges.find(range => range.value === "custom")?.days || 0);
    } else if (selectedPreset) {
      onDaysChange(selectedPreset.days);
    }
  }

  function handleCustomDaysChange() {
    if (selectedRange === 'custom' && customDays > 0) {
      onDaysChange(customDays);
    }
  }

  // // Initialize with default
  // $: if (selectedRange) {
  //   handleRangeChange();
  // }
</script>

<div class="flex items-center gap-2">
  <select 
    bind:value={selectedRange} 
    onchange={handleRangeChange}
    class="text-sm border border-gray-300 dark:border-gray-600 rounded-lg px-3 py-1.5 bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 focus:border-transparent"
  >
    {#each presetRanges as range}
      <option value={range.value}>{range.label}</option>
    {/each}
  </select>
  
  {#if showCustomInput}
    <div class="flex items-center gap-1">
      <input 
        type="number" 
        bind:value={customDays}
        onblur={handleCustomDaysChange}
        min="1"
        max="365" 
        class="w-20 text-sm border border-gray-300 dark:border-gray-600 rounded-lg px-2 py-1.5 bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 focus:border-transparent"
        placeholder="30"
      />
      <span class="text-sm text-gray-600 dark:text-gray-400">days</span>
    </div>
  {/if}
</div>