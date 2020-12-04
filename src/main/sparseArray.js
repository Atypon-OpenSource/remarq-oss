import sortedIndex from 'lodash/sortedIndex';
import indexOf from 'lodash/indexOf';

define([],function(){
    function SparseArray() {
        this.positions = [];
        this.values = [];

        this.insert = function (pos, val) {
            var idx = sortedIndex(this.position, pos);
            if (this.positions[idx] == pos) {
                this.values[idx] = val;
            } else {
                this.positions.splice(idx, 0, pos);
                this.values.splice(idx, 0, val);
            }

            return idx;
        }

        this.getByPos = function (pos) {
            var idx = sortedIndexOf(this.position, pos);
            if (idx != -1) {
                return this.values[idx];
            } else {
                return null;
            }
        }


        this.getByIdx = function (idx) {
            return {pos: this.positions[idx], val: this.values[idx]};
        }

        this.indexOfPos = function (pos) {
            return indexOf(this.positions, pos);
        }

        this.indexOfVal = function (val) {
            return indexOf(this.values, val);
        }

        this.removeIdx = function (idx) {
            this.positions.splice(idx, 1);
            this.values.splice(idx, 1);
        }
    }
    return SparseArray;
});