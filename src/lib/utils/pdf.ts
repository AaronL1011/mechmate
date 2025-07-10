import type { Equipment, TaskCompletion } from '$lib/types/db';
import { formatCurrency, formatDate } from './format';

function generateTableRow(completion: TaskCompletion, equipment: Equipment): string {
	return `
                  <tr>
                    <td>${formatDate(completion.completed_date)}</td>
                    <td>${completion.task_title || 'N/A'}</td>
                    <td>${completion.completed_usage_value ? `${completion.completed_usage_value} ${equipment?.usage_unit || ''}` : 'N/A'}</td>
                    <td>${completion.notes || 'N/A'}</td>
                    <td>${completion.cost ? formatCurrency(completion.cost) : 'N/A'}</td>
                    <td>${completion.service_provider || 'N/A'}</td>
                    <td>${completion.parts_used ? completion.parts_used.join(', ') : 'N/A'}</td>
                  </tr>
                `;
}
export const createReportHTML = (
	equipment: Equipment,
	completions: TaskCompletion[],
	equipmentTypeName?: string
) => {
	return `
      <!DOCTYPE html>
      <html>
        <head>
          <title>${equipment.name} - Maintenance History</title>
          <style>
            body { font-family: Arial, sans-serif; margin: 20px; }
            .header { text-align: center; margin-bottom: 30px; }
            .equipment-info { margin-bottom: 20px; }
            table { width: 100%; border-collapse: collapse; margin-top: 20px; }
            th, td { border: 1px solid #ddd; padding: 8px; text-align: left; }
            th { background-color: #f2f2f2; }
            .no-data { text-align: center; color: #666; padding: 20px; }
            @media print { .no-print { display: none; } }
          </style>
        </head>
        <body>
          <div class="header">
            <h1>${equipment.name} - Maintenance History</h1>
            <p>Generated on ${new Date().toLocaleDateString()}</p>
          </div>
          
          <div class="equipment-info">
            <h3>Equipment Details</h3>
            <p><strong>Type:</strong> ${equipmentTypeName || 'Unknown'}</p>
            ${equipment.make ? `<p><strong>Make:</strong> ${equipment.make}</p>` : ''}
            ${equipment.model ? `<p><strong>Model:</strong> ${equipment.model}</p>` : ''}
            ${equipment.year ? `<p><strong>Year:</strong> ${equipment.year}</p>` : ''}
            ${equipment.serial_number ? `<p><strong>Serial Number:</strong> ${equipment.serial_number}</p>` : ''}
            <p><strong>Current Usage:</strong> ${equipment.current_usage_value} ${equipment.usage_unit}</p>
          </div>
          
          ${
						completions.length > 0
							? `
            <table>
              <thead>
                <tr>
                  <th>Date</th>
                  <th>Task</th>
                  <th>Usage</th>
                  <th>Notes</th>
                  <th>Cost</th>
                  <th>Service Provider</th>
                  <th>Parts Used</th>
                </tr>
              </thead>
              <tbody>
                ${completions.map((completion) => generateTableRow(completion, equipment)).join('')}
              </tbody>
            </table>`
							: `
            <div class="no-data">
              <p>No maintenance history found for this equipment.</p>
            </div>
          `
					}
          
          <div class="no-print" style="margin-top: 30px; text-align: center;">
            <button onclick="window.print()">Print Report</button>
          </div>
          
          <script>
            // Auto-trigger print dialog when page loads
            window.onload = function() {
              setTimeout(function() {
                window.print();
              }, 500);
            };
          </script>
        </body>
      </html>
    `;
};
