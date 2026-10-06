/** 
 * This file is part of LoopInsighT1, an open source tool to
 * simulate closed-loop glycemic control in type 1 diabetes.
 * Distributed under the MIT software license.
 * See https://lt1.org for further information.
 */

import { h } from 'vue'
import ModelStructure from '../structureDiagrams/ModelStructure.vue'
import createVueApp from '../util/createVueApp.js'

const app = createVueApp('modelStructure', {
	data() { return {
		selectedModel: "",
	}},
	// render function instead of a template string, so that the Vue build
	// without the template compiler can be used
	render() {
		return h(ModelStructure, { selectedModel: (<any>this).selectedModel })
	},
})

// pre-select model through hidden input form, if desired
const selection = document.getElementById("selectedModel")
if (selection !== null) {
	(<any>app).selectedModel = (<any>selection).value
}
